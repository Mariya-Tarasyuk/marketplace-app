import { Component, OnInit, ChangeDetectorRef } from '@angular/core'; // 1. Додали ChangeDetectorRef
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../services/api';
import { forkJoin } from 'rxjs';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule],
  templateUrl: './admin-dashboard.html',
  styleUrl: './admin-dashboard.css'
})
export class AdminDashboard implements OnInit {
activeTab: 'users' | 'assets' | 'reviews' | 'audit' | 'transactions' = 'users';
  dbUsers: any[] = [];
  dbAssets: any[] = [];
  dbReviews: any[] = [];
  dbAudit: any[] = [];
  dbTransactions: any[] = [];
  filteredUsers: any[] = [];
  filteredAssets: any[] = [];
  filteredReviews: any[] = [];
  filteredAudit: any[] = [];
  filteredTransactions: any[] = [];


  searchTerm: string = '';
  totalUsers = 0;
  totalAssets = 0;
  totalReviews = 0;
  totalAudit = 0;
  totalTransactions = 0;
  
  isLoading = false; // Повертаємо на false
  editingUserId: number | null = null;
  editForm: any = {};

  // 2. Інжектимо нашу "чарівну паличку" (cdr)
  constructor(private apiService: ApiService, private cdr: ChangeDetectorRef) {}

  ngOnInit() {
    this.loadData(false);
  }

  setTab(tab: 'users' | 'assets' | 'reviews' | 'audit' | 'transactions') {
    this.activeTab = tab;
    this.searchTerm = '';
    this.filterData();
  }

  loadData(showSuccessAlert: boolean = true) {
    // 3. Геніальний трюк для обходу NG0100: відкладаємо блокування кнопки на 1 мікро-крок
    Promise.resolve().then(() => { 
      this.isLoading = true; 
      this.cdr.detectChanges(); 
    });
    
    forkJoin({
      stats: this.apiService.getAdminStats(),
      users: this.apiService.getAdminUsers(),
      assets: this.apiService.getAdminAssets(),
      reviews: this.apiService.getAdminReviews(),
      audit: this.apiService.getAdminAuditLogs(),
      transactions: this.apiService.getAdminTransactions()
    }).subscribe({
      next: (res) => {
        this.totalUsers = res.stats.users;
        this.totalAssets = res.stats.assets;
        this.totalReviews = res.stats.reviews;
        this.totalAudit = res.stats.audit;
        this.totalTransactions = res.stats.transactions;

        this.dbUsers = res.users;
        this.dbAssets = res.assets;
        this.dbReviews = res.reviews;
        this.dbAudit = res.audit;
        this.dbTransactions = res.transactions;
        this.filterData();
        
        this.isLoading = false;
        
        // 4. НАКАЗУЄМО ANGULAR ВІДМАЛЮВАТИ СТОРІНКУ (вирішує проблему "пустої сторінки")
        this.cdr.detectChanges();

        if (showSuccessAlert && typeof window !== 'undefined') {
          alert('Database fully synchronized!');
        }
      },
      error: (err) => {
        console.error(err);
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  filterData() {
    if (!this.searchTerm) {
      // 5. Клонуємо масиви (...), щоб Angular зрозумів, що дані ОНОВИЛИСЯ
      this.filteredUsers = [...this.dbUsers];
      this.filteredAssets = [...this.dbAssets];
      this.filteredReviews = [...this.dbReviews];
        this.filteredAudit = [...this.dbAudit];
        this.filteredTransactions = [...this.dbTransactions];
      return;
    }
    const term = this.searchTerm.toLowerCase();
    
    if (this.activeTab === 'users') {
      this.filteredUsers = this.dbUsers.filter(u => u.login.toLowerCase().includes(term) || u.email.toLowerCase().includes(term));
    } else if (this.activeTab === 'assets') {
      this.filteredAssets = this.dbAssets.filter(a => a.title.toLowerCase().includes(term) || a.author.toLowerCase().includes(term));
    } else if (this.activeTab === 'reviews') {
      this.filteredReviews = this.dbReviews.filter(r => r.asset.toLowerCase().includes(term) || r.comment.toLowerCase().includes(term));
    } else if (this.activeTab === 'audit') {
      this.filteredAudit = this.dbAudit.filter(l => l.description.toLowerCase().includes(term) || l.action_type.toLowerCase().includes(term));
    }else if (this.activeTab === 'transactions') {
      this.filteredTransactions = this.dbTransactions.filter(t => t.buyer.toLowerCase().includes(term) || t.asset.toLowerCase().includes(term));
    }
  }

  startEdit(user: any) {
    this.editingUserId = user.id;
    this.editForm = { ...user };
  }

  cancelEdit() {
    this.editingUserId = null;
  }

  saveEdit(userId: number) {
    if (!userId) return;

    const userIndex = this.filteredUsers.findIndex(u => u.id === userId);
    if (userIndex !== -1) {
      this.filteredUsers[userIndex].login = this.editForm.login;
      this.filteredUsers[userIndex].email = this.editForm.email;
      this.filteredUsers[userIndex].balance = this.editForm.balance;
    }

    this.editingUserId = null;

    this.apiService.updateUser(userId, this.editForm).subscribe({
      next: () => {
        const dbIndex = this.dbUsers.findIndex(u => u.id === userId);
        if (dbIndex !== -1) {
          this.dbUsers[dbIndex] = { ...this.filteredUsers[userIndex] };
        }
      },
      error: (err) => {
        alert('Помилка синхронізації з БД: ' + err.message);
        this.loadData(false); 
      }
    });
  }

  banUser(id: number, login: string) {
    const confirmMessage = `⚠️ Are you absolutely sure you want to ban "${login}"?\n\nBecause of PostgreSQL CASCADE, all 3D assets and reviews associated with this user will be PERMANENTLY DELETED!`;
    
    if (typeof window !== 'undefined' && confirm(confirmMessage)) {
      this.dbUsers = this.dbUsers.filter(u => u.id !== id);
      this.filterData(); 
      this.totalUsers--;

      this.apiService.deleteUser(id).subscribe({
        next: () => {
          this.loadData(false); 
        },
        error: (err) => {
          alert('Error banning user: ' + err.message);
          this.loadData(false); 
        }
      });
    }
  }
  
  generateMockTransactions() {
    this.isLoading = true;
    this.apiService.generateTransactions().subscribe({
      next: () => {
        this.loadData(true); // Оновлюємо таблиці після генерації
      },
      error: (err) => {
        alert('Error generating transactions: ' + err.message);
        this.isLoading = false;
      }
    });
  }
}
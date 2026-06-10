import { Component, OnInit, ChangeDetectorRef, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core'; // Додано CUSTOM_ELEMENTS_SCHEMA
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../services/api';
import { forkJoin } from 'rxjs';

@Component({
  selector: 'app-client-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule],
  templateUrl: './client-dashboard.html',
  styleUrl: './client-dashboard.css',
  schemas: [CUSTOM_ELEMENTS_SCHEMA] 
})
export class ClientDashboard implements OnInit {
  isDataLoaded = true;
  isLoading = true;
  
  activeTab: 'purchases' | 'reviews' | 'orders' = 'purchases';
  
  orders: any[] = [];
  client: any = null;
  purchases: any[] = [];
  reviews: any[] = [];
  
  topUpAmount: number = 0;

  constructor(private apiService: ApiService, private cdr: ChangeDetectorRef) {}

  ngOnInit() {
    this.loadClientProfile();
  }

  loadClientProfile() {
    this.isLoading = true;
    this.apiService.getClientMe().subscribe({
      next: (userData) => {
        this.client = userData;
        this.isDataLoaded = true;
        this.loadClientData(userData.id);
      },
      error: (err) => {
        if (err.status === 404) this.isDataLoaded = false;
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

loadClientData(clientId: number) {
    forkJoin({
      purchases: this.apiService.getClientPurchases(clientId),
      reviews: this.apiService.getClientReviews(clientId),
      orders: this.apiService.getClientOrders(clientId)
    }).subscribe({
      next: (res) => {
        this.purchases = res.purchases;
        this.reviews = res.reviews;
        this.orders = res.orders;
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Error loading client data:', err);
        // ЗАХИСТ: вимикаємо завантаження навіть при помилці бекенду!
        this.isLoading = false; 
        this.cdr.detectChanges();
      }
    });
  }
  setTab(tab: 'purchases' | 'reviews' | 'orders') {
    this.activeTab = tab;
  }

  processTopUp() {
    if (this.topUpAmount <= 0) return;
    this.isLoading = true;
    this.apiService.topUpBalance(this.client.id, this.topUpAmount).subscribe({
      next: (res) => {
        alert(res.message);
        this.client.balance_usd = Number(this.client.balance_usd) + this.topUpAmount;
        this.topUpAmount = 0;
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        alert('Top up failed: ' + err.message);
        this.isLoading = false;
      }
    });
  }

  leaveReview(assetId: number, title: string) {
    const ratingStr = prompt(`Leave a rating for "${title}" (1 to 5):`, "5");
    if (!ratingStr) return;
    
    const rating = parseInt(ratingStr, 10);
    if (isNaN(rating) || rating < 1 || rating > 5) {
      alert('Invalid rating. Please enter a number between 1 and 5.');
      return;
    }
    
    const comment = prompt('Write your review comment:', 'Absolutely stunning quality! Recommended.');
    if (!comment) return;

    this.isLoading = true;
    this.apiService.addReview({ 
      client_id: this.client.id, 
      asset_id: assetId, 
      rating: rating, 
      comment: comment 
    }).subscribe({
      next: () => {
        alert('Review published successfully! ⭐');
        this.loadClientData(this.client.id); // Оновлюємо дані, щоб відгук одразу з'явився у таблиці
      },
      error: (err) => {
        alert('Error publishing review: ' + err.message);
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  // --- ФУНКЦІЯ ЗАВАНТАЖЕННЯ КУПЛЕНОЇ МОДЕЛІ ---
  
  downloadAsset(fileUrl: string | null, title: string) {
    if (!fileUrl) {
      alert('File link is missing. The author might not have uploaded the file correctly.');
      return;
    }

    // 1. Обробка тестових посилань із CSV (симуляція)
    if (fileUrl.includes('cloud.storage')) {
      alert(`[Simulation Mode]\nStarting secure download of "${title}" assets from cloud node...`);
      return;
    }

    // 2. Реальне завантаження файлу з папки uploads
    try {
      const link = document.createElement('a');
      link.href = fileUrl;
      
      // Намагаємось визначити розширення або ставимо .zip за замовчуванням
      const extension = fileUrl.split('.').pop()?.split('?')[0] || 'zip';
      const safeTitle = title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
      
      link.download = `${safeTitle}_result.${extension}`;
      link.target = '_blank';
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('Download failed:', err);
      alert('Could not start download. Please try again or contact the author.');
    }
  }
}
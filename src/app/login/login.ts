import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms'; // 1. ДОДАЛИ МОДУЛЬ ФОРМ!
import * as Papa from 'papaparse';
import { ApiService } from '../services/api'; 
import { firstValueFrom } from 'rxjs'; 

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule], // 2. ПІДКЛЮЧИЛИ FormsModule ТУТ! (RouterLink прибрали, бо він тут більше не треба)
  templateUrl: './login.html',
  styleUrl: './login.css'
})
export class Login {
  selectedFiles: File[] = [];
  selectedFilesText = 'Choose CSV Files...';
  isUploading = false;
  uploadProgress = '';

  // Змінні для реєстрації
  isRegisterMode = false;
  regLogin = '';
  regEmail = '';
  regPassword = '';
  regRole = 3; 

  constructor(private apiService: ApiService, private router: Router) {}

  // 3. НОВА ФУНКЦІЯ ДЛЯ АВТОРА

  // Змінні для входу
  loginEmail = '';
  loginPassword = '';

  // Справжня функція логіну
  loginUser() {
    if (!this.loginEmail || !this.loginPassword) {
      alert('Please enter your email and password');
      return;
    }

    this.apiService.loginUser({ email: this.loginEmail, password: this.loginPassword }).subscribe({
      next: (user) => {
        if (typeof window !== 'undefined') {
          // Зберігаємо справжній ID користувача!
          localStorage.setItem('userId', user.id.toString()); 
          
          // Маршрутизуємо в залежності від ролі з БД
          if (user.role_id === 2) {
            localStorage.setItem('userRole', 'author');
            this.router.navigate(['/author-dashboard']);
          } else if (user.role_id === 3) {
            localStorage.setItem('userRole', 'client');
            this.router.navigate(['/marketplace']);
          } else if (user.role_id === 1) {
            localStorage.setItem('userRole', 'admin');
            this.router.navigate(['/admin-dashboard']);
          }
        }
      },
      error: () => alert('Invalid email or password! Please try again.')
    });
  }

  loginAsAuthor() {
    if (typeof window !== 'undefined') {
      localStorage.setItem('userRole', 'author'); 
    }
    this.router.navigate(['/author-dashboard']);
  }

  loginAsClient() {
    if (typeof window !== 'undefined') {
      localStorage.setItem('userRole', 'client'); 
    }
    this.router.navigate(['/marketplace']);
  }

  loginAsGuest() {
    if (typeof window !== 'undefined') {
      localStorage.setItem('userRole', 'guest'); 
    }
    this.router.navigate(['/marketplace']);
  }

  toggleMode() {
    this.isRegisterMode = !this.isRegisterMode;
  }

  secretAdminAccess() {
    if (typeof window !== 'undefined') {
      localStorage.setItem('userRole', 'admin'); 
    }
    this.router.navigate(['/admin-dashboard']);
  }

  registerNewUser() {
    if (!this.regLogin || !this.regEmail || !this.regPassword) {
      alert('Please fill in all fields including password');
      return;
    }
    
    this.apiService.registerUser({ 
      login: this.regLogin, 
      email: this.regEmail, 
      password: this.regPassword, 
      role_id: this.regRole 
    }).subscribe({
      next: () => {
        // МАГІЯ: Автоматичний логін одразу після реєстрації!
        this.loginEmail = this.regEmail;
        this.loginPassword = this.regPassword;
        this.loginUser(); // Викликаємо нашу робочу функцію логіну
      },
      error: (err) => alert('Registration failed: ' + (err.error?.error || err.message))
    });
  }

  // ... далі йдуть твої функції onFileSelected, parseFile та uploadData, їх не чіпай! ...
  onFileSelected(event: any) {
    this.selectedFiles = Array.from(event.target.files);
    this.selectedFilesText = `${this.selectedFiles.length} files selected`;
  }

  // Обгортка для PapaParse, щоб зробити його зручним
  parseFile(file: File): Promise<any[]> {
    return new Promise((resolve) => {
      Papa.parse(file, { header: true, dynamicTyping: true, complete: (res) => resolve(res.data) });
    });
  }

  async uploadData() {
    if (this.selectedFiles.length === 0) return;
    this.isUploading = true;

    // Шукаємо файли за їхніми назвами
    const usersFile = this.selectedFiles.find(f => f.name.includes('users'));
    const assetsFile = this.selectedFiles.find(f => f.name.includes('assets'));
    const reviewsFile = this.selectedFiles.find(f => f.name.includes('reviews'));

    try {
      // 1. Завантажуємо Користувачів
      if (usersFile) {
        this.uploadProgress = 'Parsing Users...';
        const usersData = await this.parseFile(usersFile);
        this.uploadProgress = 'Saving Users to Database...';
        await firstValueFrom(this.apiService.importUsers(usersData));
      }

      // 2. Завантажуємо Моделі
      if (assetsFile) {
        this.uploadProgress = 'Parsing Assets...';
        const assetsData = await this.parseFile(assetsFile);
        this.uploadProgress = 'Saving Assets to Database...';
        await firstValueFrom(this.apiService.importAssets(assetsData));
      }

      // 3. Завантажуємо Відгуки
      if (reviewsFile) {
        this.uploadProgress = 'Parsing Reviews (Triggers activating)...';
        const reviewsData = await this.parseFile(reviewsFile);
        this.uploadProgress = 'Saving Reviews...';
        await firstValueFrom(this.apiService.importReviews(reviewsData));
      }

      alert('All files imported successfully into PostgreSQL!');
    } catch (err: any) {
      alert('Import failed: ' + err.message);
    } finally {
      this.isUploading = false;
      this.uploadProgress = '';
      this.selectedFiles = [];
      this.selectedFilesText = 'Choose CSV Files...';
    }
  }
}
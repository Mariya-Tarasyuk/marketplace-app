import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ApiService } from '../services/api';

@Component({
  selector: 'app-order-board',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './order-board.html',
  styleUrl: './order-board.css'
})
export class OrderBoard implements OnInit {
  availableOrders: any[] = [];
  isLoading = true;

  // ТУТ ВАЖЛИВО: ми правильно інжектимо ApiService та ChangeDetectorRef
  constructor(private apiService: ApiService, private cdr: ChangeDetectorRef) {}

  ngOnInit() {
    this.loadOrders();
  }

  loadOrders() {
    this.isLoading = true;
    this.apiService.getOrders().subscribe({
      next: (data) => {
        this.availableOrders = data;
        // Безпечне вимкнення годинника для Angular 21!
        setTimeout(() => { 
          this.isLoading = false; 
          this.cdr.markForCheck(); 
        }, 0); 
      },
      error: (err) => {
        console.error('API Error:', err);
        setTimeout(() => { 
          this.isLoading = false; 
          this.cdr.markForCheck(); 
        }, 0);
        alert('Помилка підключення до бази замовлень!');
      }
    });
  }

  showAlert(message: string) {
    alert(message);
  }

  acceptOrder(orderId: number) {
    const userId = typeof window !== 'undefined' ? localStorage.getItem('userId') : null;
    
    if (!userId) {
      alert('Error: You must be logged in to accept orders.');
      return;
    }

    this.apiService.acceptOrder(orderId, parseInt(userId)).subscribe({
      next: () => {
        alert('🎉 Congratulations! You have successfully accepted this order.');
        this.loadOrders(); // Миттєво перезавантажуємо список. Прийняте замовлення зникне з Біржі!
      },
      error: (err) => {
        alert('Failed to accept order: ' + (err.error?.error || err.message));
      }
    });
  }
  
}
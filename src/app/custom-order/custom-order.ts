import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../services/api';

@Component({
  selector: 'app-custom-order',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule],
  templateUrl: './custom-order.html',
  styleUrl: './custom-order.css' 
})
export class CustomOrder {
  // Категорії для випадаючого списку
  categories = [
    'Characters', 'Environments', 'Props', 'Weapons & Armor', 
    'Vehicles & Transport', 'Architecture', 'Sci-Fi & Cyberpunk'
  ];

  // Змінні, які користувач бачить на екрані
  uiTitle = '';
  uiCategory = '';
  uiNotes = '';

  // Змінні, які підуть у Базу Даних
  order = { 
    total_price_usd: null, 
    deadline: '' 
  };

  constructor(private apiService: ApiService, private router: Router) {}

  submitOrder() {
    const userId = typeof window !== 'undefined' ? localStorage.getItem('userId') : null;
    const role = typeof window !== 'undefined' ? localStorage.getItem('userRole') : null;

    if (role !== 'client' || !userId) {
      alert('Only registered Clients can post custom orders!');
      return;
    }
    
    // Перевірка, чи всі поля заповнені
    if (!this.uiTitle || !this.order.total_price_usd || !this.order.deadline || !this.uiNotes) {
      alert('Please fill out all required fields.');
      return;
    }

    // МАГІЯ: Форматуємо гарний текст для БД
    const finalNotes = `[Project: ${this.uiTitle}]\n[Category: ${this.uiCategory || 'General'}]\n\nDetails:\n${this.uiNotes}`;

    // Збираємо фінальний об'єкт для відправки
    const payload = {
      client_id: userId,
      total_price_usd: this.order.total_price_usd,
      deadline: this.order.deadline,
      client_notes: finalNotes
    };

    this.apiService.createOrder(payload).subscribe({
      next: () => {
        alert('Your Custom Order has been posted successfully! Artists will see it now.');
        this.router.navigate(['/marketplace']);
      },
      error: (err) => alert('Error: ' + err.message)
    });
  }
}
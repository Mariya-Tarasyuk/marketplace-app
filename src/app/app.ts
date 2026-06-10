import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Marketplace } from './marketplace/marketplace';
import { CustomOrder } from './custom-order/custom-order';
import { AuthorDashboard } from './author-dashboard/author-dashboard';
import { Login } from './login/login';

@Component({
  selector: 'app-root',
  standalone: true,
  // Додали AuthorPortfolio в масив
  imports: [RouterOutlet], 
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  title = 'marketplace-app';
}
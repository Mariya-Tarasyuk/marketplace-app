import { Routes } from '@angular/router';
import { Marketplace } from './marketplace/marketplace';
import { CustomOrder } from './custom-order/custom-order';
import { AuthorDashboard } from './author-dashboard/author-dashboard';
import { Login } from './login/login';
import { AdminDashboard } from './admin-dashboard/admin-dashboard';
import { ClientDashboard } from './client-dashboard/client-dashboard';
import { OrderBoard } from './order-board/order-board';
import { Artists } from './artists/artists';

export const routes: Routes = [
  { path: '', component: Login },
  { path: 'marketplace', component: Marketplace },
  { path: 'custom-order', component: CustomOrder },
  { path: 'author-dashboard', component: AuthorDashboard },
  { path: 'admin-dashboard', component: AdminDashboard },
  { path: 'client-dashboard', component: ClientDashboard },
  { path: 'order-board', component: OrderBoard }, 
  {path: 'artists', component: Artists}
];
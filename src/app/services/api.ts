import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private baseUrl = 'http://localhost:3000/api';

  constructor(private http: HttpClient) {}

  // Додаємо ?t=${Date.now()} щоб браузер ніколи не кешував ці відповіді
  getAdminStats(): Observable<any> { 
    return this.http.get(`${this.baseUrl}/admin/stats?t=${Date.now()}`); 
  }
  
  getAdminUsers(): Observable<any[]> { 
    return this.http.get<any[]>(`${this.baseUrl}/admin/users?t=${Date.now()}`); 
  }
  
  getAdminAssets(): Observable<any[]> { 
    return this.http.get<any[]>(`${this.baseUrl}/admin/assets?t=${Date.now()}`); 
  }
  
  getAdminReviews(): Observable<any[]> { 
    return this.http.get<any[]>(`${this.baseUrl}/admin/reviews?t=${Date.now()}`); 
  }
  getAdminAuditLogs(): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/admin/audit?t=${Date.now()}`);
  }
  getAdminTransactions(): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/admin/transactions?t=${Date.now()}`);
  }
  generateTransactions(): Observable<any> {
    return this.http.post(`${this.baseUrl}/admin/generate-transactions`, {});
  }

  updateUser(id: number, data: any): Observable<any> {
    return this.http.put(`${this.baseUrl}/admin/users/${id}`, data);
  }

  deleteUser(id: number): Observable<any> {
    return this.http.delete(`${this.baseUrl}/admin/users/${id}`);
  }

  // --- AUTHOR METHODS ---
// 1. Додай новий метод логіну:
  loginUser(credentials: any): Observable<any> {
    return this.http.post(`${this.baseUrl}/auth/login`, credentials);
  }

  // 2. ЗАМІНИ старі getClientMe та getAuthorMe на ці:
 

  getAuthorMe(): Observable<any> {
    const userId = typeof window !== 'undefined' ? localStorage.getItem('userId') : '';
    const query = userId ? `&userId=${userId}` : '';
    return this.http.get(`${this.baseUrl}/author/me?t=${Date.now()}${query}`);
  }
  getAuthorAssets(authorId: number): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/author/${authorId}/assets?t=${Date.now()}`);
  }

  withdrawFunds(authorId: number, amount: number): Observable<any> {
    return this.http.post(`${this.baseUrl}/author/${authorId}/withdraw`, { amount });
  }

  getAuthorSales(authorId: number): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/author/${authorId}/sales?t=${Date.now()}`);
  }

  getAuthorReviews(authorId: number): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/author/${authorId}/reviews?t=${Date.now()}`);
  }

 // Знайди uploadAuthorAsset і заміни його на:
  uploadAuthorAsset(authorId: number, assetData: any): Observable<any> {
    return this.http.post(`${this.baseUrl}/author/${authorId}/assets`, assetData);
  }

  updateAssetPrice(assetId: number, price: number): Observable<any> {
    return this.http.put(`${this.baseUrl}/author/assets/${assetId}`, { price });
  }

  deleteAuthorAsset(assetId: number): Observable<any> {
    return this.http.delete(`${this.baseUrl}/author/assets/${assetId}`);
  }

  // --- MARKETPLACE & CLIENT METHODS ---
   getClientMe(): Observable<any> {
    const userId = typeof window !== 'undefined' ? localStorage.getItem('userId') : '';
    const query = userId ? `&userId=${userId}` : '';
    return this.http.get(`${this.baseUrl}/client/me?t=${Date.now()}${query}`);
  }

  getMarketplaceAssets(): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/marketplace/assets?t=${Date.now()}`);
  }

  getClientPurchases(clientId: number): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/client/${clientId}/purchases?t=${Date.now()}`);
  }

  getClientReviews(clientId: number): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/client/${clientId}/reviews?t=${Date.now()}`);
  }

  topUpBalance(clientId: number, amount: number): Observable<any> {
    return this.http.post(`${this.baseUrl}/client/${clientId}/topup`, { amount });
  }

  buyAsset(payload: { buyer_id: number, asset_id: number, amount: number }): Observable<any> {
    return this.http.post(`${this.baseUrl}/marketplace/buy`, payload);
  }

  addReview(payload: { client_id: number, asset_id: number, rating: number, comment: string }): Observable<any> {
    return this.http.post(`${this.baseUrl}/client/reviews`, payload);
  }

 registerUser(userData: { login: string, email: string, password: string, role_id: number }): Observable<any> {
    return this.http.post(`${this.baseUrl}/auth/register`, userData);
  }

  
  createOrder(orderData: any): Observable<any> {
    return this.http.post(`${this.baseUrl}/orders`, orderData);
  }

  getOrders(): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/orders?t=${Date.now()}`);
  }

  getArtists(): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/artists?t=${Date.now()}`);
  }

  getClientOrders(clientId: number): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/client/${clientId}/orders?t=${Date.now()}`);
  }

  acceptOrder(orderId: number, authorId: number): Observable<any> {
    return this.http.put(`${this.baseUrl}/orders/${orderId}/accept`, { author_id: authorId });
  }
  getAuthorOrders(authorId: number): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/author/${authorId}/orders?t=${Date.now()}`);
  }

  
  // Завантаження файлу на сервер
  uploadFile(file: File): Observable<any> {
    const formData = new FormData();
    formData.append('modelFile', file);
    // Зверни увагу: тут не передаються JSON-заголовки, Angular сам встановить multipart/form-data
    return this.http.post(`${this.baseUrl}/upload`, formData);
  }

  completeOrder(orderId: number, fileUrl: string): Observable<any> {
  return this.http.put(`${this.baseUrl}/orders/${orderId}/complete`, { file_url: fileUrl });
}
  // Три методи для імпорту
  importUsers(data: any[]): Observable<any> { return this.http.post(`${this.baseUrl}/import/users`, data); }
  importAssets(data: any[]): Observable<any> { return this.http.post(`${this.baseUrl}/import/assets`, data); }
  importReviews(data: any[]): Observable<any> { return this.http.post(`${this.baseUrl}/import/reviews`, data); }
}



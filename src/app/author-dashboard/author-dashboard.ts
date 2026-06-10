import { Component, OnInit, ChangeDetectorRef, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../services/api';
import { forkJoin } from 'rxjs'; // Додали forkJoin для одночасних запитів

@Component({
  selector: 'app-author-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule],
  templateUrl: './author-dashboard.html',
  styleUrl: './author-dashboard.css',
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class AuthorDashboard implements OnInit {
  isDataLoaded = true;
  isLoading = true;
  
  activeTab: 'assets' | 'sales' | 'reviews' | 'orders' = 'assets'; // Система вкладок

  author: any = null;
  assets: any[] = [];
  sales: any[] = [];
  reviews: any[] = [];
  acceptedOrders: any[] = []; // Для прийнятих замовлень
  showUploadForm = false;
  newAsset = {
    title: '',
    price_usd: 0,
    polygons_count: 0,
    category_id: 1, // 1: Character, 2: Environment
    is_rigged: false
  };
  withdrawAmount: number = 0;

  selectedFile: File | null = null;
  
  constructor(private apiService: ApiService, private cdr: ChangeDetectorRef) {}

  ngOnInit() {
    this.loadAuthorProfile();
  }
  

  loadAuthorProfile() {
    this.isLoading = true;
    this.apiService.getAuthorMe().subscribe({
      next: (userData) => {
        this.author = userData;
        this.isDataLoaded = true;
        this.loadAllAuthorData(userData.id);
      },
      error: (err) => {
        if (err.status === 404) this.isDataLoaded = false;
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  // Завантажуємо Моделі, Продажі та Відгуки одночасно!
  loadAllAuthorData(authorId: number) {
    forkJoin({
      assets: this.apiService.getAuthorAssets(authorId),
      sales: this.apiService.getAuthorSales(authorId),
      reviews: this.apiService.getAuthorReviews(authorId),
      orders: this.apiService.getAuthorOrders(authorId) // НОВЕ
    }).subscribe({
      next: (res) => {
        this.assets = res.assets;
        this.sales = res.sales;
        this.reviews = res.reviews;
        this.acceptedOrders = res.orders; // НОВЕ
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Error loading dashboard data:', err);
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  setTab(tab: 'assets' | 'sales' | 'reviews' | 'orders') {
    this.activeTab = tab;
  }

  // --- CRUD ДЛЯ МОДЕЛЕЙ ---

  // Метод відкриття/закриття форми
  toggleUploadForm() {
    this.showUploadForm = !this.showUploadForm;
  }

  onFileSelected(event: any) {
    const file = event.target.files[0];
    if (file) {
      this.selectedFile = file;
    }
  }
  
  // ЗАМІНИ старий метод uploadNewModel на цей:
  uploadNewModel() {
    if (!this.selectedFile) {
      this.showAlert('Please select a 3D model file (.zip, .fbx, .obj) first!');
      return;
    }

    if (!this.newAsset.title || !this.newAsset.price_usd || !this.newAsset.category_id) {
      this.showAlert('Please fill in all required fields (Title, Category, Price).');
      return;
    }

    this.isLoading = true; 

    // ЕТАП 1: Завантажуємо сам файл через наше  API
    this.apiService.uploadFile(this.selectedFile).subscribe({
      next: (uploadResponse) => {
        
        // ЕТАП 2: Файл завантажено! Беремо посилання і зберігаємо модель у Базу Даних
        const payload = { 
          ...this.newAsset, 
          file_url: uploadResponse.url // Додаємо справжнє посилання з бекенду
        };

        this.apiService.uploadAuthorAsset(this.author.id, payload).subscribe({
          next: () => {
            this.showAlert('🚀 Model uploaded successfully!');
            this.selectedFile = null; // Очищаємо файл
           this.newAsset = { 
              title: '', 
              price_usd: null as any, 
              category_id: 1, 
              polygons_count: null as any, 
              is_rigged: false 
            };
            this.activeTab = 'assets';
            this.showUploadForm = false;
            this.loadAllAuthorData(this.author.id); // Оновлюємо списки
          },
          error: (err) => {
            this.showAlert('Error saving asset data: ' + err.message);
            this.isLoading = false;
            this.cdr.markForCheck();
          }
        });
      },
      error: (err) => {
        this.showAlert('Failed to upload the file! Check server console.');
        this.isLoading = false;
        this.cdr.markForCheck();
      }
    });
  }

  editPrice(asset: any) {
    const newPrice = prompt(`Enter new price for "${asset.title}":`, asset.price_usd);
    if (newPrice && !isNaN(Number(newPrice))) {
      this.apiService.updateAssetPrice(asset.id, Number(newPrice)).subscribe(() => {
        this.loadAllAuthorData(this.author.id);
      });
    }
  }

  deleteAsset(assetId: number, title: string) {
    if (confirm(`Are you sure you want to delete "${title}"?\nAll reviews and sales history for this model will be permanently removed!`)) {
      this.apiService.deleteAuthorAsset(assetId).subscribe(() => {
        this.loadAllAuthorData(this.author.id); // Тригер аудиту в БД спрацює сам!
      });
    }
  }

  // --- ВИТЯГ КОШТІВ ---
  processWithdrawal() {
    if (this.withdrawAmount <= 0 || this.withdrawAmount > this.author.balance_usd) return;
    this.apiService.withdrawFunds(this.author.id, this.withdrawAmount).subscribe({
      next: (res) => {
        alert(res.message);
        this.author.balance_usd -= this.withdrawAmount;
        this.withdrawAmount = 0;
        this.cdr.detectChanges();
      }
    });
  }

 

  // Функція для показу сповіщень
  showAlert(message: string) {
    alert(message);
  }

 handleImageError(asset: any) {
    asset.file_url = null; // Знищуємо зламане посилання
    this.cdr.detectChanges(); // ПРИМУСОВО змушуємо Angular перемалювати цю картку!
  }

  // 1. Визначаємо: це 3D модель чи звичайна картинка
  getPreviewType(url: string | undefined): 'model' | 'image' {
    if (!url) return 'image';
    const lowerUrl = String(url).toLowerCase();
    if (lowerUrl.includes('.glb') || lowerUrl.includes('.gltf')) return 'model';
    return 'image';
  }

  // 2. Отримуємо посилання (якщо це архів .zip, одразу даємо заглушку)
  getImageSrc(asset: any): string {
    if (asset.file_url && (asset.file_url.includes('.jpg') || asset.file_url.includes('.png') || asset.file_url.includes('.webp'))) {
      return asset.file_url;
    }
    return this.getCategoryImage(asset.category_id);
  }

  getCategoryImage(categoryId: number): string {
    const images: { [key: number]: string } = {
      1: 'https://unsplash.com/photos/an-abstract-purple-and-blue-background-with-a-star-91wAfJ4cjXQ',
      2: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=600&q=80',
      3: 'https://unsplash.com/photos/a-close-up-of-a-metal-structure-made-of-wood-and-metal-pyET8SQTc0A',
      5: 'https://images.unsplash.com/photo-1511407397940-d57f68e81203?w=600&q=80',
      6: 'https://images.unsplash.com/photo-1519501025264-65ba15a82390?w=600&q=80',
      8: 'https://images.unsplash.com/photo-1614729939124-032f0b56c9ce?w=600&q=80'
    };
    // Нова дефолтна картинка: красивий фіолетовий неоновий градієнт/абстракція
    return images[categoryId] || 'https://unsplash.com/photos/time-lapse-photography-of-lights-3shfnfzdFVc';
  }

  //  якщо посилання мертве, JS миттєво підміняє його
  onImageError(event: any, categoryId: number) {
    event.target.src = this.getCategoryImage(categoryId);
    // Якщо навіть резервна картинка не завантажиться (наприклад, через AdBlock), просто ховаємо іконку
    event.target.onerror = () => { event.target.style.display = 'none'; };
  }

  submitWork(orderId: number, files: FileList | null) {
    if (!files || files.length === 0) return;
    this.isLoading = true;
    this.apiService.uploadFile(files[0]).subscribe({
      next: (res) => {
        this.apiService.completeOrder(orderId, res.url).subscribe(() => {
          alert('Work submitted! Money transferred.');
          this.loadAllAuthorData(this.author.id);
        });
      },
      error: (err) => { this.isLoading = false; alert(err.message); }
    });
  }

}

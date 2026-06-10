import { Component, OnInit, ChangeDetectorRef, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../services/api'; 

@Component({
  selector: 'app-marketplace',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule],
  templateUrl: './marketplace.html',
  styleUrl: './marketplace.css',
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class Marketplace implements OnInit {
  currentUser: any = null;
  isGuest: boolean = true;
  isLoading: boolean = true;

  allAssets: any[] = [];
  filteredAssets: any[] = [];

  searchTerm: string = '';
  selectedCategory: string = 'All Artworks';
  minPrice: number | null = null;
  maxPrice: number | null = null;
  maxPolygons: number | null = null;
  riggedOnly: boolean = false;
  sortOption: string = 'newest';

  constructor(private apiService: ApiService, private cdr: ChangeDetectorRef) {}

  ngOnInit() {
    const role = typeof window !== 'undefined' ? localStorage.getItem('userRole') : 'guest';

    if (role === 'client') {
      this.isGuest = false;
      this.loadClientData();
    } else {
      this.isGuest = true;
      this.currentUser = null;
    }

    this.loadAssets();
  }

  loadClientData() {
    this.apiService.getClientMe().subscribe({
      next: (user) => {
        this.currentUser = user;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Database error:', err);
        this.currentUser = { login: 'DemoClient', balance_usd: 0 }; 
        this.cdr.detectChanges();
      }
    });
  }

  loadAssets() {
    this.isLoading = true;
    this.apiService.getMarketplaceAssets().subscribe({
      next: (assets) => {
        this.allAssets = assets;
        this.filteredAssets = assets;
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Error loading assets:', err);
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  applyFilters() {
    // 1. Фільтрація
    this.filteredAssets = this.allAssets.filter(asset => {
      const matchesSearch = !this.searchTerm || 
        asset.title.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        asset.author_name.toLowerCase().includes(this.searchTerm.toLowerCase());
      
      const matchesCategory = this.selectedCategory === 'All Artworks' || 
        (this.selectedCategory === 'Characters' && asset.category_id === 1) ||
        (this.selectedCategory === 'Props' && asset.category_id === 2) ||
        (this.selectedCategory === 'Environments' && asset.category_id === 3) ||
        (this.selectedCategory === 'Architecture' && asset.category_id === 6) ||
        (this.selectedCategory === 'Vehicles' && asset.category_id === 5) ||
        (this.selectedCategory === 'Sci-Fi' && asset.category_id === 8);
        
      const matchesMinPrice = this.minPrice === null || asset.price_usd >= this.minPrice;
      const matchesMaxPrice = this.maxPrice === null || asset.price_usd <= this.maxPrice;
      
      const matchesPolys = this.maxPolygons === null || asset.polygons_count <= this.maxPolygons;
      const matchesRig = !this.riggedOnly || asset.is_rigged === true;

      return matchesSearch && matchesCategory && matchesMinPrice && matchesMaxPrice && matchesPolys && matchesRig;
    });

    // 2. Сортування 
    this.filteredAssets.sort((a, b) => {
      switch (this.sortOption) {
        case 'priceAsc':
          return a.price_usd - b.price_usd;
        case 'priceDesc':
          return b.price_usd - a.price_usd;
        case 'ratingDesc':
          const ratingA = parseFloat(a.average_rating) || 0;
          const ratingB = parseFloat(b.average_rating) || 0;
          return ratingB - ratingA;
        case 'nameAsc':
          return a.title.localeCompare(b.title);
        case 'newest':
        default:
          return b.id - a.id;
      }
    });
  } 

  setCategory(category: string) {
    this.selectedCategory = category;
    this.applyFilters();
  }

  buyModel(asset: any) {
    if (this.isGuest || !this.currentUser) {
      alert('Please log in as a Client to buy 3D models.');
      return;
    }

    const currentBalance = Number(this.currentUser.balance_usd);
    const assetPrice = Number(asset.price_usd);

    if (currentBalance < assetPrice) {
      alert('Insufficient funds! Please top up your balance in the Client Dashboard.');
      return;
    }
    
    if (confirm(`Are you sure you want to buy "${asset.title}" for $${assetPrice}?`)) {
      this.apiService.buyAsset({ 
        buyer_id: this.currentUser.id, 
        asset_id: asset.id, 
        amount: assetPrice 
      }).subscribe({
        next: () => {
          alert('Purchase successful! 🎉 You can now download it from your Client Dashboard.');
          this.currentUser.balance_usd = currentBalance - assetPrice; 
          this.cdr.detectChanges();
        },
        error: (err) => alert('Transaction failed: ' + (err.error?.error || err.message))
      });
    }
  }

  // Визначаємо тип контенту за посиланням
  // 1. Покращений метод визначення типу
 handleImageError(asset: any) {
    asset.file_url = null; // Знищуємо зламане посилання
    this.cdr.detectChanges(); // ПРИМУСОВО змушуємо Angular перемалювати цю картку!
  } 
  
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

  // 4. Безвідмовний рятівник: якщо посилання мертве, JS миттєво підміняє його
  onImageError(event: any, categoryId: number) {
    event.target.src = this.getCategoryImage(categoryId);
    // Якщо навіть резервна картинка не завантажиться (наприклад, через AdBlock), просто ховаємо іконку
    event.target.onerror = () => { event.target.style.display = 'none'; };
  }
}
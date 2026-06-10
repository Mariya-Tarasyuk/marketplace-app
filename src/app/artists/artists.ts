import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ApiService } from '../services/api';

@Component({
  selector: 'app-artists',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './artists.html',
  styleUrl: './artists.css'
})
export class Artists implements OnInit {
  artists: any[] = [];
  isLoading = true;

  // --- ЗМІННІ ДЛЯ ПОРТФОЛІО (МОДАЛКИ) ---
  selectedArtist: any = null;
  artistModels: any[] = [];
  isModalOpen = false;
  isLoadingModels = false;

  constructor(private apiService: ApiService, private cdr: ChangeDetectorRef) {}

  ngOnInit() {
    this.apiService.getArtists().subscribe({
      next: (data) => {
        this.artists = data;
        setTimeout(() => { this.isLoading = false; this.cdr.markForCheck(); }, 0);
      },
      error: (err) => {
        console.error(err);
        setTimeout(() => { this.isLoading = false; this.cdr.markForCheck(); }, 0);
      }
    });
  }

  // --- МЕТОДИ ДЛЯ ПОРТФОЛІО ---
  openPortfolio(artist: any) {
    this.selectedArtist = artist;
    this.isModalOpen = true;
    this.isLoadingModels = true;
    this.artistModels = [];

    // Завантажуємо моделі конкретного автора (цей метод вже є у твоєму сервісі)
    this.apiService.getAuthorAssets(artist.id).subscribe({
      next: (data) => {
        this.artistModels = data;
        setTimeout(() => { this.isLoadingModels = false; this.cdr.markForCheck(); }, 0);
      },
      error: (err) => {
        console.error(err);
        setTimeout(() => { this.isLoadingModels = false; this.cdr.markForCheck(); }, 0);
      }
    });
  }

  closePortfolio() {
    this.isModalOpen = false;
    this.selectedArtist = null;
  }
}
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { API_CONFIG } from '../http/api.config';

@Injectable({
  providedIn: 'root'
})
export class FileApiService {
  private readonly http = inject(HttpClient);
  private readonly apiConfig = inject(API_CONFIG);
  private readonly baseUrl = this.apiConfig.baseUrl + '/files';

  upload(file: File): Observable<string> {
    const formData = new FormData();
    formData.append('file', file);
    
    return this.http.post<any>(`${this.baseUrl}/upload`, formData).pipe(
      map(response => response.data)
    );
  }
}

import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import { API_ENDPOINTS } from '../../../core/constants/app.constants';
import { HttpService } from '../../../core/http/http.service';
import { PageResponse } from '../../../core/models/pagination.model';
import { UserAccount, UsersQuery } from './models/user-account.model';

interface ApiEnvelope<T> {
  data: T;
  message?: string;
  status?: string;
}

@Injectable({ providedIn: 'root' })
export class UsersApiService {
  private readonly httpService = inject(HttpService);
  private readonly endpoint = API_ENDPOINTS.users;

  list(query: UsersQuery): Observable<PageResponse<UserAccount>> {
    return this.httpService.get<ApiEnvelope<PageResponse<UserAccount>>>(this.endpoint, {
      params: query
    }).pipe(map(response => response.data));
  }

  getById(userId: string): Observable<UserAccount> {
    return this.httpService.get<ApiEnvelope<UserAccount>>(`${this.endpoint}/${userId}`)
      .pipe(map(response => response.data));
  }
}
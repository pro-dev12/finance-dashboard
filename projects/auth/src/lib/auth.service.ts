import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { NotifierService } from 'notifier';
import { BehaviorSubject, Observable, of, throwError, Subject } from 'rxjs';
import { mergeMap, tap, catchError } from 'rxjs/operators';
import { AppConfig } from 'src/app/app.config';
import { Storage } from 'storage';

export type Token = string;
const refreshTokenKey = 'refresh_token';

export type UserIdentityInfo = {
  name: string;
  preferred_username: string;
  sub: string;
};
const headers = new HttpHeaders({
  'Content-Type': 'application/x-www-form-urlencoded',
  'accept': 'application/json',
});

@Injectable()
export class AuthService {
  _isAuthorizedChange: BehaviorSubject<boolean> = new BehaviorSubject(false);

  get isAuthorizedChange(): Observable<boolean> {
    return this._isAuthorizedChange;
  }

  get isAuthorized() {
    return this._isAuthorizedChange.value;
  }

  private _token: string;
  private _tokenData: any;
  private _refreshToken: string;
  private _expirationDate: number;

  userInfo: UserIdentityInfo;

  constructor(
    private _notification: NotifierService,
    private _appConfig: AppConfig,
    private storage: Storage,
    private _http: HttpClient
  ) { }

  isTokenInvalid(): boolean {
    return this._refreshToken && this._expirationDate && Date.now() > this._expirationDate;
  }

  getToken() {
    return this._token;
  }

  refreshToken(): Observable<any> {
    if (!this._appConfig.identity)
      throw new Error('Invalid identity config');

    const refreshToken = this.storage.getItem(refreshTokenKey);
    if (!refreshToken)
      return of(null);

    const data = new URLSearchParams();
    const { url, clientId, clientSecret } = this._appConfig.identity;

    data.set('client_id', clientId);
    data.set('client_secret', clientSecret);
    data.set('grant_type', 'refresh_token');
    data.set('refresh_token', refreshToken);

    return this._http.post(url + 'connect/token', data.toString(), { headers })
      .pipe(
        mergeMap(item => this._handleTokenResponse(item)),
        catchError(err => {
          this._unauthorize();
          return throwError(err);
        }),
      );
  }

  private _handleTokenResponse(data): Observable<any> {
    this._token = data.access_token;
    this._refreshToken = data.refresh_token;

    this._tokenData = parseJwt(data.access_token);
    this._expirationDate = Date.now() + (this._tokenData.expiresIn * 1000);

    this.storage.setItem(refreshTokenKey, this._refreshToken);

    return this._loadUserDataIfNeed();
  }

  public logOut(): Observable<any> {
    const { url } = this._appConfig.identity;

    return this._http.get(`${url}account/logout`, {})
      .pipe(tap(res => this._unauthorize()));
  }

  private _unauthorize() {
    this._isAuthorizedChange.next(false);
    this._token = null;
    this._tokenData = null;
    this._refreshToken = null;
    this._expirationDate = null;
  }

  public logOutWithRedirect() {
    const { url } = this._appConfig.identity;
    window.location.href = `${url}account/logout`;
  }

  public async initialize(code: Token): Promise<UserIdentityInfo> {
    if (!code) {
      console.log('Code is not exist');
      return;
    }

    const { url, clientId, clientSecret, redirectUri } = this._appConfig.identity;

    const data = new URLSearchParams();

    data.set('client_id', clientId);
    data.set('client_secret', clientSecret);
    data.set('code', code);
    data.set('grant_type', 'authorization_code');
    data.set('redirect_uri', redirectUri);

    return await this._http.post(`${url}connect/token`, data.toString(), { headers })
      .pipe(mergeMap((response: any) => this._handleTokenResponse(response)))
      .toPromise();
  }

  private _loadUserDataIfNeed(): Observable<any> {
    const { url } = this._appConfig.identity;
    if (this.userInfo)
      return of(null);

    return this._http.get(`${url}connect/userinfo`, {
      headers: {
        Authorization: 'Bearer ' + this._token
      }
    }).pipe(
      tap(
        (res: UserIdentityInfo) => {
          this.userInfo = res;
          this._isAuthorizedChange.next(true);
        },
        (e) => this._notification.showError(e.message)
      ),
    );
  }
}

function parseJwt(token) {
  const base64Url = token.split('.')[1];
  const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  const jsonPayload = decodeURIComponent(atob(base64).split('').map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join(''));

  return JSON.parse(jsonPayload);
}

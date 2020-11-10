import { Injectable } from '@angular/core';
import { HttpRepository, IPaginationResponse } from 'communication';
import { CookieService } from 'ngx-cookie-service';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { IConnection, IInstrument } from 'trading';

@Injectable()
export class RealInstrumentsRepository extends HttpRepository<IInstrument> {
  private _connection: IConnection;

  protected get _baseUrl(): string {
    return this._communicationConfig.rithmic.http.url + 'Instrument';
  }

  protected get _apiKey(): string {
    return this._connection?.connectionData?.apiKey;
  }

  protected get _httpOptions() {
    return {
      headers: {
        'Api-Key': this._apiKey ?? '',
      },
    };
  }

  forConnection(connection: IConnection) {
    if (this._connection && this._connection?.id === connection?.id)
      return this;

    const repository = new RealInstrumentsRepository(
      this._http,
      this._communicationConfig,
      this._injector
    );

    repository._connection = connection;

    return repository;
  }

  getItemById(id): Observable<IInstrument> {
    return super.getItemById(id).pipe(
      map((res: any) => res.result),
    );
  }

  getItems(params = {}): Observable<IPaginationResponse<IInstrument>> {
    const _params = {
      criteria: '',
      ...params,
    };

    return super.getItems(_params).pipe(
      map((res: any) => {
        const data = res.result.map(({ symbol, exchange }) => ({
          id: symbol,
          symbol,
          exchange,
          tickSize: 0.01,
        }));

        return { data, } as IPaginationResponse<IInstrument>;
      }),
    );
  }
}

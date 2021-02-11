import { Injectable } from '@angular/core';
import { AccountsManager } from 'accounts-manager';
import { Observable, Subject } from 'rxjs';
import { map, takeUntil, tap } from 'rxjs/operators';
import {
  HistoryRepository,
  InstrumentsRepository,
  Level1DataFeed,
  IQuote,
} from 'trading';
import { Datafeed } from './Datafeed';
import { IBarsRequest, IQuote as ChartQuote, IRequest } from './models';
import { StockChartXPeriodicity } from './TimeFrame';

declare let StockChartX: any;

@Injectable()
export class RithmicDatafeed extends Datafeed {
  private _destroy = new Subject();

  private _unsubscribeFn: VoidFunction;

  constructor(
    private _accountsManager: AccountsManager,
    private _instrumentsRepository: InstrumentsRepository,
    private _historyRepository: HistoryRepository,
    private _levelOneDatafeedService: Level1DataFeed,
  ) {
    super();

    this._accountsManager.connections
      .pipe(takeUntil(this._destroy))
      .subscribe(() => {
        const connection = this._accountsManager.getActiveConnection();

        this._historyRepository = this._historyRepository.forConnection(connection);
      });
  }


  send(request: IBarsRequest) {
    super.send(request);
    this.subscribeToRealtime(request);
    this._loadData(request);
  }

  loadInstruments(): Observable<any[]> {
    return this._instrumentsRepository.getItems().pipe(
      tap(instruments => {
        StockChartX.getAllInstruments = () => instruments.data;
      }),
      map(i => i.data),
    );
  }

  private _loadData(request: IBarsRequest) {
    const { kind, count, chart } = request;
    const { instrument, timeFrame } = chart;

    if (!instrument) {
      this.cancel(request);

      // throw new Error('Invalid instrument!');

      return;
    }

    if (kind === 'moreBars') {
      this.cancel(request);

      return;
    }

    const { symbol, exchange } = instrument;

    const params = {
      Exchange: exchange,
      Periodicity: this._convertPeriodicity(timeFrame.periodicity),
      BarSize: timeFrame.interval,
      BarCount: count,
      Skip: 0,
    };
    this._historyRepository.getItems({ id: symbol, ...params }).subscribe(
      (res) => {
        if (this.isRequestAlive(request)) {
          this.onRequestCompleted(request, res.data);
          // this._webSocketService.connect(() => this.subscribeToRealtime(request)); // todo: test
        }
      },
      () => this.cancel(request),
    );
  }

  _convertPeriodicity(periodicity: string): string {

    switch (periodicity) {
      case StockChartXPeriodicity.YEAR:
        return 'Yearly';
      case StockChartXPeriodicity.MONTH:
        return 'Mounthly';
      case StockChartXPeriodicity.WEEK:
        return 'Weekly';
      case StockChartXPeriodicity.DAY:
        return 'Daily';
      case StockChartXPeriodicity.HOUR:
        return 'Hourly';
      case StockChartXPeriodicity.MINUTE:
        return 'Minute';
      default:
        throw new Error('Undefined periodicity ' + periodicity);
    }
  }
  subscribeToRealtime(request: IBarsRequest) {
    const chart = request.chart;
    const instrument = this._getInstrument(request);
    this._levelOneDatafeedService.subscribe(instrument);

    this._unsubscribe();
    this._unsubscribeFn = this._levelOneDatafeedService.on((quote: IQuote) => {
      const _quote: ChartQuote = {
        // Ask: quote.volume;
        // AskSize: number;
        // Bid: number;
        // BidSize: number;
        // Instrument: string;
        Price: quote.price,
        Time: quote.timestamp,
        Volume: quote.volume,
      } as any;

      this.processQuote(chart, _quote);
    });
  }

  private _getInstrument(req: IRequest) {
    return req.instrument ?? req.chart.instrument;
  }

  _unsubscribe() {
    if (this._unsubscribeFn)
      this._unsubscribeFn();

    this._unsubscribeFn = null;
  }

  destroy() {
    super.destroy();
    this._destroy.next();
    this._destroy.complete();
    this._unsubscribe();
  }
}

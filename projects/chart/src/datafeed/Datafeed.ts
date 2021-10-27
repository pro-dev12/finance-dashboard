import { Injectable } from '@angular/core';
import { IAccount, ISession, OrderSide } from 'trading';
import { BarsUpdateKind, IBarsRequest, IQuote, IRequest, IStockChartXInstrument, RequestKind, } from './models';
import { BarHandler, IBarHandler } from './bar-handlers/BarHandler';
import { IBar, IChart, IDetails } from '../models/chart';
import { BarAction } from './bar-handlers/ChartBarHandler';
import { isInTimeRange } from 'session-manager';

export type IDateFormat = (request: IRequest) => string;

export interface IKeyValuePair<TKey, TValue> {
  key: TKey;
  value: TValue;
}


export interface IDatafeed {
  send(request: IRequest);

  cancel(request: IRequest);
}

declare let StockChartX: any;


@Injectable()
export abstract class Datafeed implements IDatafeed {
  /**
   * @internal
   */
  private static _requestId = 0;

  protected _session;

  protected _historyItems = [];

  /**
   * @internal
   */
  private _requests = new Map<number, IRequest>();

  protected barHandler: IBarHandler;

  /**
   * @internal
   */
  protected _account: IAccount;

  /**
   * @internal
   */
  private _quotes: IQuote[] = [];


  setSession(session: ISession, chart) {
    const oldSession = this._session;
    this._session = session;
    if (oldSession?.id !== session?.id) {
      this._recalculateData(chart);
    }
  }

  private _recalculateData(chart) {
    if (!this.barHandler)
      return;

    chart.dataManager.clearBarDataSeries();
    const historyItems = [];
    for (let i = 0; i < this._historyItems.length; i++) {
      const historyItem = this._historyItems[i];
      if (isInTimeRange(historyItem.date, this._session.workingTimes)) {
        historyItems.push(historyItem);
      }
    }
    chart.dataManager.appendBars(this.barHandler.processBars(historyItems));
    chart.setNeedsUpdate(true);
  }

  /**
   * Executes request post cancel actions (e.g. hides waiting bar).
   * @method onRequstCanceled
   * @memberOf StockChartX.Datafeed#
   * @protected
   */
  protected onRequstCanceled(request: IBarsRequest) {
    if (this._requests.size === 0)
      request.chart.hideWaitingBar();
  }

  /**
   * Executes request post complete actions (e.g. hides waiting bar, updates indicators, refreshes chart).
   * @method onRequestCompleted
   * @memberOf StockChartX.Datafeed#
   * @protected
   */
  protected onRequestCompleted(request: IBarsRequest, bars: IBar[]) {
    this._requests.delete(request.id);

    const chart = request.chart;
    const dataManager = chart.dataManager;
    const oldFirstVisibleRecord = chart.firstVisibleRecord;
    const oldLastVisibleRecord = chart.lastVisibleRecord;
    const oldPrimaryBarsCount = request.kind === RequestKind.MORE_BARS ? chart.primaryBarDataSeries().low.length : 0;
    const instrument = chart.instrument;

    if (!this.barHandler) {
      this.barHandler = new BarHandler(request.chart);
    }

    switch (request.kind) {
      case RequestKind.BARS: {
        dataManager.clearBarDataSeries();
        this._historyItems = bars;
        this.barHandler.clear();
        const filteredBars = bars.filter(bar => isInTimeRange(bar.date, this._session?.workingTimes));
        console.log('filteredBars', filteredBars.length, bars.length);
        const processBars = this.barHandler.processBars(bars);
        request.chart.dataManager.appendBars(processBars);
        const endTime = processBars[processBars.length - 1]?.date?.getTime() ?? 0;
        if (Array.isArray(this._quotes)) {
          for (const quote of this._quotes) {
            if ((quote?.date?.getTime() ?? 0) > endTime)
              this.processQuote(request, quote);
            else
              console.warn('Dev check datafeed quote time less then history', quote.date, endTime);
          }
        }
        this._quotes = [];
        break;
      }
      /*   case RequestKind.MORE_BARS: {
           this.barHandler.clear();
           this._historyItems = [...bars, ...this._historyItems];
           const preparedBars = this.barHandler.prependBars(
             bars.filter(bar => isInTimeRange(bar.date, this._session?.workingTimes)));
           request.chart.dataManager.insertBars(0, preparedBars);
           break;
         }*/
      default:
        throw new Error(`Unknown request kind: ${request.kind}`);
    }

    let barsCount = chart.primaryBarDataSeries().low.length - oldPrimaryBarsCount;
    if (instrument) {
      barsCount = Math.round(chart.lastVisibleIndex - chart.firstVisibleIndex);
    }

    // if !instrument then load bars for chart, not for compare
    if (instrument) {
      if (request.kind === RequestKind.BARS) {
        chart.recordRange(barsCount > 0 && barsCount < 100 ? barsCount : 100);
      } else if (request.kind === RequestKind.MORE_BARS) {
        chart.firstVisibleRecord = barsCount < 0 ? 0 : oldFirstVisibleRecord + barsCount;
        chart.lastVisibleRecord = oldLastVisibleRecord + Math.abs(barsCount);
      }
    }

    chart.fireValueChanged(StockChartX.ChartEvent.HISTORY_LOADED, { request, bars });

    chart.hideWaitingBar();
    chart.updateIndicators();
    chart.setNeedsAutoScale();
    chart.setNeedsUpdate(true);
    chart.updateComputedDataSeries();
    chart.dateScale.onMoreHistoryRequestCompleted();
  }

  // region IDatafeed members

  /**
   * Sends request to the datafeed provider.
   * @method send
   * @param {StockChartX~Request} request The processing request.
   * @memberOf StockChartX.Datafeed#
   */
  send(request: IRequest) {
    this._requests.set(request.id, request);

    request.chart.showWaitingBar();
  }

  /**
   * Cancels request processing.
   * @method cancel
   * @param {StockChartX~Request} request The cancelling request.
   * @memberOf StockChartX.Datafeed#
   */
  cancel(request: IRequest) {
    this._requests.delete(request.id);
    this.onRequstCanceled(request as IBarsRequest);
  }

  changeAccount(account: IAccount) {
    this._account = account;
  }

  /**
   * Destroy request.
   * @method destroy
   * @param {StockChartX~Request}.
   * @memberOf StockChartX.Datafeed#
   */
  destroy() {
    this._requests.clear();
  }

  // endregion

  /**
   * Determines whether request is alive.
   * @method isRequestAlive
   * @param {StockChartX~Request} request The request.
   * @memberof StockChartX.Datafeed#
   * @returns {boolean} True if request is alive, otherwise false.
   */
  isRequestAlive(request: IRequest): boolean {
    return this._requests.has(request.id);
  }

  private _accomulateQuotes(quote: IQuote) {
    this._quotes.push(quote);
  }

  protected processQuote(request: IRequest, quote: IQuote): void {
    if (quote?.instrument?.symbol == null)
      return;

    const { chart } = request;

    if (!this.barHandler) {
      this.barHandler = new BarHandler(chart);
    }

    if (request.kind === 'bars' && this.isRequestAlive(request)) {
      this._accomulateQuotes(quote);
      return;
    }

    // if instrument is null then you operate with main bars otherwise with others bars datasiries(compare instruments)
    const instrument = chart.instrument.symbol == quote.instrument.symbol ? null : quote.instrument;
    const lastBar = this._getLastBar(chart, instrument);

    if (!lastBar)
      return;

    const bar = {
      open: quote.price,
      high: quote.price,
      low: quote.price,
      close: quote.price,
      volume: quote.volume,
      date: new Date(quote.date),
    };
    const action = this._processBar(bar);
    if (action === BarAction.Add)
      chart.applyAutoScroll(BarsUpdateKind.NEW_BAR);
    else if (action === BarAction.Update)
      chart.applyAutoScroll(BarsUpdateKind.TICK);

    this._updateLastBarDetails(quote, chart, instrument);
    chart.updateIndicators();
    chart.updateComputedDataSeries();
    chart.setNeedsUpdate();
  }

  private _processBar(bar): BarAction {
    if (isInTimeRange(bar.date, this._session?.workingTimes)) {
      const barResult = this.barHandler.processBar(bar);
      if (barResult?.action === BarAction.Add) {
        this._historyItems.push(barResult.bar);
        return BarAction.Add;
      } else if (barResult?.action === BarAction.Update) {
        const lastBar = this._historyItems[this._historyItems.length - 1];
        const barData = barResult.bar;
        lastBar.close = barData.close;
        if (barData.high > lastBar.high) {
          lastBar.high = barData.high;
        }
        if (barData.low < lastBar.low) {
          lastBar.low = barData.low;
        }
        lastBar.volume += barData.volume;
        this._historyItems[this._historyItems.length - 1] = lastBar;
        return BarAction.Update;
      }
    } else {
      this._historyItems.push(bar);
      return BarAction.None;
    }
  }

  private _updateLastBarDetails(quote: IQuote, chart: IChart, instrument?: IStockChartXInstrument) {
    const symbol = instrument && instrument.symbol !== chart.instrument.symbol ? instrument.symbol : '';
    const barDataSeries = chart.dataManager.barDataSeries(symbol);
    const detailsDataSeries = barDataSeries.details;
    if (!detailsDataSeries)
      return;

    let lastDetails = detailsDataSeries.lastValue as IDetails[];
    if (!lastDetails) {
      detailsDataSeries.setValue(detailsDataSeries.length - 1, []);
      lastDetails = detailsDataSeries.lastValue as IDetails[];
    }

    const details = handleNewQuote(quote, lastDetails);

    detailsDataSeries.updateLast(details);
  }

  protected _getLastBar(chart: IChart, instrument?: IStockChartXInstrument): IBar {
    return chart.dataManager.getLastBar(instrument);
  }
}

function handleNewQuote(quote: IQuote, details: IDetails[]) {
  const { volume, tradesCount: _tradesCount, price } = quote;
  const tradesCount = _tradesCount ?? volume;
  let item = details.find(i => i.price === price);

  if (!item) {
    item = {
      bidInfo: {
        volume: 0,
        tradesCount: 0
      },
      askInfo: {
        volume: 0,
        tradesCount: 0
      },
      volume,
      tradesCount,
      price
    };

    details.push(item);
  }

  switch (quote.side) {
    case OrderSide.Sell:
      item.bidInfo.volume += volume;
      item.bidInfo.tradesCount += tradesCount;
      break;
    case OrderSide.Buy:
      item.askInfo.volume += volume;
      item.askInfo.tradesCount += tradesCount;
      break;
  }

  item.volume += volume;
  item.tradesCount += tradesCount;

  return details;
}

import { AfterViewInit, Component, ElementRef, Injector, OnInit, ViewChild } from '@angular/core';
import { untilDestroyed } from '@ngneat/until-destroy';
import { AccountsManager } from 'accounts-manager';
import { convertToColumn, LoadingComponent } from 'base-components';
import { RealtimeActionData } from 'communication';
import { CellClickDataGridHandler, Column, DataGrid, IFormatter, IViewBuilderStore, RoundFormatter } from 'data-grid';
import { KeyBinding, KeyboardListener } from 'keyboard';
import { ILayoutNode, IStateProvider, LayoutNode, LayoutNodeEvent } from 'layout';
import { SynchronizeFrames } from 'performance';
import { IConnection, IInstrument, IOrder, ITrade, L2, Level1DataFeed, Level2DataFeed, OrderBooksRepository, OrderSide, OrdersRepository } from 'trading';
import { DomFormComponent } from './dom-form/dom-form.component';
import { DomSettingsSelector } from './dom-settings/dom-settings.component';
import { DomSettings } from './dom-settings/settings';
import { DomItem } from './dom.item';
import { histogramComponent, HistogramComponent } from './histogram';
import { HistogramCell } from './histogram/histogram.cell';

export interface DomComponent extends ILayoutNode, LoadingComponent<any, any> {
}

export class DomItemMax {
  ask: number;
  bid: number;
  volume: number;
  totalAsk: number;
  totalBid: number;
  currentAsk: number;
  currentBid: number;

  handleChanges(change): any {
    let result;
    if (!change)
      return;

    for (const key in change) {
      if (change[key] == null || this[key] >= change[key])
        continue;

      if (result == null)
        result = {};

      this[key] = change[key];
      result[key] = change[key];
    }
    return result;
  }

  clear() {
    this.ask = null;
    this.bid = null;
    this.volume = null;
    this.totalAsk = null;
    this.totalBid = null;
    this.currentAsk = null;
    this.currentBid = null;
  }
}

const ROWS = 400;
const DOM_HOTKEYS = 'domHotkeys';

interface IDomState {
  instrument: IInstrument;
  settings?: any;
}

const directionsHints = {
  'window-left': 'Left View',
  'full-screen-window': 'Horizontal View',
  'window-right': 'Right View',
};
const topDirectionIndex = 1;

enum Columns {
  BidDelta = 'bidDelta',
  AskDelta = 'askDelta',
  All = 'all',
}

@Component({
  selector: 'lib-dom',
  templateUrl: './dom.component.html',
  styleUrls: ['./dom.component.scss'],
  providers: [
    {
      provide: IViewBuilderStore,
      useValue: {
        [histogramComponent]: HistogramComponent
      }
    }
  ]
})
@LayoutNode()
export class DomComponent extends LoadingComponent<any, any> implements OnInit, AfterViewInit, IStateProvider<IDomState> {
  columns: Column[] = [
    // '_id',
    'orders',
    ['volume', 'volume', 'histogram'],
    'price',
    [Columns.BidDelta, 'delta'],
    ['bid', 'bid', 'histogram'],
    'ltq',
    ['currentBid', 'c.bid', 'histogram'],
    ['currentAsk', 'c.ask', 'histogram'],
    ['ask', 'ask', 'histogram'],
    [Columns.AskDelta, 'delta'],
    ['totalBid', 't.bid', 'histogram'],
    ['totalAsk', 't.ask', 'histogram'],
    // 'tradeColumn',
    // 'askDepth',
    // 'bidDepth',
  ].map(convertToColumn);

  keysStack: KeyboardListener = new KeyboardListener();

  domKeyHandlers = {
    autoCenter: () => this.centralize(),
    autoCenterAllWindows: () => {
      this.broadcastHotkeyCommand('autoCenter');
    },
    buyMarket: () => {
    },
    sellMarket: () => {
    },
    hitBid: () => {
    },
    joinBid: () => {
    },
    liftOffer: () => {
    },
    oco: () => {
    },
    flatten: () => {
    },
    cancelAllOrders: () => {
    },
    quantity1: () => {
    },
    quantity2: () => {
    },
    quantity3: () => {
    },
    quantity4: () => {
    },
    quantity5: () => {
    },
    quantityToPos: () => {
    },
    stopsToPrice: () => {
    },
    clearAlerts: () => {
    },
    clearAlertsAllWindow: () => {
    },
    clearAllTotals: () => {
      for (let item of this.items) {
        item.totalBid.clear();
        item.totalAsk.clear();
      }
    },
    clearCurrentTrades: () => {
      for (let item of this.items) {
        item.orders.clearOrder();
        item.askDelta.clear();
        item.bidDelta.clear();
      }
    },
    clearCurrentTradesAllWindows: () => {
      this.broadcastHotkeyCommand('clearCurrentTrades');
    },
    clearCurrentTradesDown: () => {
      this.forDownItems(item => {
        item.currentAsk.clear();
        item.currentBid.clear();
      });
    },
    clearCurrentTradesDownAllWindows: () => {
      this.broadcastHotkeyCommand('clearCurrentTradesDown');
    },
    clearCurrentTradesUp: () => {
      this.forUpItems((item) => {
        item.currentAsk.clear();
        item.currentBid.clear();
      });
    },
    clearCurrentTradesUpAllWindows: () => {
      this.broadcastHotkeyCommand('clearCurrentTradesUp');
    },
    clearTotalTradesDown: () => {
      this.forDownItems((item) => {
        item.totalAsk.clear();
        item.totalBid.clear();
      });
    },
    clearTotalTradesDownAllWindows: () => {
      this.broadcastHotkeyCommand('clearTotalTradesDown');
    },
    clearTotalTradesUp: () => {
      this.forUpItems((item) => {
        item.totalAsk.clear();
        item.totalBid.clear();
      });
    },
    clearTotalTradesUpAllWindows: () => {
      this.broadcastHotkeyCommand('clearTotalTradesUp');
    },
    clearVolumeProfile: () => {
      for (let item of this.items) {
        item.volume.clear();
      }
    }
  };

  @ViewChild(DomFormComponent)
  private _domForm: DomFormComponent;

  handlers = [
    ...[Columns.AskDelta, Columns.BidDelta].map(column => (
      new CellClickDataGridHandler<DomItem>({
        column, handler: (item) => this._createOrder(column, item),
      })
    )),
  ];

  private _accountId: string;

  directions = ['window-left', 'full-screen-window', 'window-right'];
  currentDirection = this.directions[this.directions.length - 1];

  @ViewChild(DataGrid, { static: true })
  dataGrid: DataGrid;

  @ViewChild(DataGrid, { read: ElementRef })
  dataGridElement: ElementRef;

  isFormOpen = true;
  isTradingLocked = false;
  bracketActive = true;
  isExtended = true;

  directionsHints = directionsHints;

  private _instrument: IInstrument;
  private _priceFormatter: IFormatter;

  public get instrument(): IInstrument {
    return this._instrument;
  }

  public set instrument(value: IInstrument) {
    if (this._instrument?.id == value.id)
      return;

    this._instrument = value;
    this._onInstrumentChange();
  }

  get isFormOnTop() {
    return this.currentDirection === this.directions[topDirectionIndex];
  }

  visibleRows = 0;

  get items() {
    return this.dataGrid.items ?? [];
  }

  set items(value) {
    this.dataGrid.items = value;
  }

  private _max = new DomItemMax()
  private _lastChangesItem: { [key: string]: DomItem } = {}

  private _map = new Map<number, DomItem>();

  private get _lastPrice(): number {
    return this._lastChangesItem.ltq?.price?._value;
  }

  get trade() {
    return this._lastPrice;
  }

  private _settings: DomSettings = new DomSettings();

  get domFormSettings() {
    return this._settings.orderArea.formSettings;
  }

  private _changedTime = 0;

  private get _tickSize() {
    return this.instrument.tickSize ?? 0.01;
    // return 0.01;
  }

  constructor(
    private _ordersRepository: OrdersRepository,
    private _orderBooksRepository: OrderBooksRepository,
    private _levelOneDatafeed: Level1DataFeed,
    protected _accountsManager: AccountsManager,
    private _levelTwoDatafeed: Level2DataFeed,
    protected _injector: Injector
  ) {
    super();
    this.setTabIcon('icon-widget-dom');
    this.setTabTitle('Dom');
    (window as any).dom = this;
  }

  ngOnInit(): void {
    super.ngOnInit();
    this._accountsManager.connections
      .pipe(untilDestroyed(this))
      .subscribe(() => {
        const connection = this._accountsManager.getActiveConnection();
        this._ordersRepository = this._ordersRepository.forConnection(connection);
        this._orderBooksRepository = this._orderBooksRepository.forConnection(connection);
        this._onInstrumentChange();
      });
    this._ordersRepository.actions
      .pipe(untilDestroyed(this))
      .subscribe((action) => this._handleRealtime(action));
    this.onRemove(
      this._levelOneDatafeed.on((trade: ITrade) => this._handleTrade(trade)),
      this._levelTwoDatafeed.on((item: L2) => this._handleL2(item))
    );
    this.addLinkObserver({
      link: DOM_HOTKEYS,
      handleLinkData: (key: string) => {
        this.domKeyHandlers[key]();
      },
    });
    this.addLinkObserver({
      link: DomSettingsSelector,
      handleLinkData: (settings: DomSettings) => {
        const common = settings.common;
        if (common) {
          for (const column of this.columns) {
            column.visible = common[column.name] != false;
          }
        }
        this.dataGrid.applyStyles({
          font: `${common.fontWeight || ''} ${common.fontSize}px ${common.fontFamily}`,
          gridBorderColor: common.generalColors.gridLineColor,
        })
        this._settings.merge(settings);
        this.detectChanges(true);
      }
    });
  }

  _handleRealtime(action: RealtimeActionData<IOrder>) {
    if (action.items)
      this._handleOrders(action.items);
  }

  _onInstrumentChange() {
    const instrument = this.instrument;
    this._priceFormatter = new RoundFormatter(instrument?.precision ?? 2);
    this._levelOneDatafeed.subscribe(instrument);
    this._levelTwoDatafeed.subscribe(instrument);

    this._loadOrderBook();
  }

  protected _loadOrderBook() {
    if (!this._accountId || !this._instrument)
      return;

    const { symbol, exchange } = this._instrument;
    this._orderBooksRepository.getItems({ symbol, exchange }).subscribe(
      res => {
        console.log(res);
        this._clear();

        let { asks, bids } = res.data[0];

        bids.sort((a, b) => a.price - b.price);
        asks.sort((a, b) => b.price - a.price);

        let index = 0;
        let price = asks[asks.length - 1].price;
        const tickSize = this._tickSize;
        const minPrice = bids[0].price;
        const maxPrice = asks[0].price;

        while (price <= maxPrice || index < ROWS) {
          this.items.unshift(this._getItem(price));
          price = this._normalizePrice(price + tickSize);
          index++;
        }

        index = 0
        price = this._normalizePrice(asks[asks.length - 1].price - tickSize);

        while (price >= minPrice || index < ROWS) {
          this.items.push(this._getItem(price));
          price = this._normalizePrice(price - tickSize);
          index++;
        }

        asks.forEach((askInfo) => this._handleTrade({ askInfo } as any));
        bids.forEach((bidInfo) => this._handleTrade({ bidInfo } as any));

        this.centralize()
        this._loadOrders();
      },
      error => this.notifier.showError(error)
    )
  }

  protected _loadOrders() {
    if (!this._accountId)
      return;

    this._ordersRepository.getItems({ id: this._accountId }).subscribe(
      res => {
        const orders = res.data;
        if (!Array.isArray(orders))
          return;

        console.log(orders);
        this._handleOrders(orders);
      },
      error => this.notifier.showError(error),
    )
  }

  private _handleOrders(orders: IOrder[]) {
    for (const order of orders) {
      if (order.instrument.symbol !== this.instrument.symbol || order.instrument.exchange != this.instrument.exchange)
        continue;

      const item = this._getItem(order.limitPrice || order.stopPrice);

      if (!item)
        continue;

      item.handleOrder(order);
    }

    this.detectChanges(true);
  }

  handleAccountChange(account: string) {
    this._accountId = account;
    this._loadOrderBook();
  }

  broadcastHotkeyCommand(commandName: string) {
    this.broadcastData(DOM_HOTKEYS, commandName);
  }

  forUpItems(handler: (data) => void) {
    let emit = true;
    for (let item of this.items) {
      if (item.isCenter)
        emit = false;

      if (emit)
        handler(item);
    }
  }

  forDownItems(handler: (item) => void) {
    let emit = false;
    for (let item of this.items) {
      if (item.isCenter)
        emit = true;

      if (emit)
        handler(item);
    }
  }

  protected _handleConnection(connection: IConnection) {
    super._handleConnection(connection);
    this._ordersRepository = this._ordersRepository.forConnection(connection);
  }

  ngAfterViewInit() {
    this._handleResize();
  }

  centralize() {
    this._handleResize();
    requestAnimationFrame(() => {
      const grid = this.dataGrid;
      const visibleRows = grid.getVisibleRows();
      var index = ROWS / 2;

      if (this._lastPrice) {
        for (let i = 0; i < this.items.length; i++) {
          const item = this.items[i];

          item.isCenter = item.lastPrice == this._lastPrice;
          if (item.isCenter)
            index = i;
        }
      }

      grid.scrollTop = index * grid.rowHeight - visibleRows / 2 * grid.rowHeight;
    });
    this.detectChanges();
  }

  @SynchronizeFrames()
  detectChanges(force = false) {
    this.dataGrid.detectChanges(force);
  }

  private _getItem(price: number): DomItem {
    if (!this._map.has(price)) {
      const item = new DomItem(price, this._settings, this._priceFormatter);
      this._map.set(price, item);
      item.setPrice(price);
    }

    return this._map.get(price);
  }

  private _clear() {
    this.items = [];
    this._map.clear();
    this._max.clear()
  }

  // private _fillData(lastPrice: number) {
  //   this.items = [];
  //   this._map.clear();
  //   this._max.clear()
  //   const data = this.items;
  //   const tickSize = this._tickSize;

  //   let price = this._normalizePrice(lastPrice - tickSize * ROWS / 2);
  //   const maxPrice = this._normalizePrice(lastPrice + tickSize * ROWS / 2);

  //   while (price < maxPrice) {
  //     price = this._normalizePrice(price);
  //     data.push(this._getItem(price));
  //   }
  // }

  protected _handleTrade(trade: ITrade) {

    if (trade.instrument?.symbol !== this.instrument?.symbol) return;

    let changes = this._lastChangesItem;
    let prevltqItem = changes.ltq;

    if (trade.askInfo && trade.askInfo.timestamp > this._changedTime) {
      const item = this._getItem(trade.askInfo.price);
      this._handleMaxChange(item.handleAsk(trade.askInfo), item);

      if (prevltqItem != changes.ltq && prevltqItem) {
        prevltqItem.clearLTQ();

        for (const item of this.items) {
          if (changes.ltq == item)
            return;

          item.clearDelta();

          // if (item.price._value < price) {
          //   item.bid.clear();
          // } else if (item.price._value > price) {
          //   item.ask.clear();
          // } else {
          //   if (item.bid._time > item.ask._time) {
          //     item.ask.clear();
          //   } else {
          //     item.bid.clear();
          //   }
          // }
        }
      }
    }

    if (trade.bidInfo && trade.bidInfo.timestamp > this._changedTime) {
      const item = this._getItem(trade.bidInfo.price);
      this._handleMaxChange(item.handleBid(trade.bidInfo), item);

      if (prevltqItem != changes.ltq && prevltqItem) {
        prevltqItem.clearLTQ();

        for (const item of this.items) {
          if (changes.ltq == item)
            return;

          item.clearDelta();

          // if (item.price._value < price) {
          //   item.bid.clear();
          // } else if (item.price._value > price) {
          //   item.ask.clear();
          // } else {
          //   if (item.bid._time > item.ask._time) {
          //     item.ask.clear();
          //   } else {
          //     item.bid.clear();
          //   }
          // }
        }
      }
    }

    // if (!this.items.length) {
    //   if (this._lastPrice)
    //     this._fillData(this._lastPrice); // todo: load order book
    //   this.centralize();
    // }

    this._changedTime = Math.max(changes.currentAsk?.currentAsk?.time || 0, changes.currentBid?.currentBid?.time || 0);
    this.detectChanges();
  }

  protected _handleL2(l2: L2) {
    if (l2.instrument?.symbol !== this.instrument?.symbol) return;

    const item = this._getItem(l2.price);
    this._handleMaxChange(item.handleL2(l2), item);
    this.detectChanges();
  }

  private _handleMaxChange(changes: any, item: DomItem) {
    const hist = this._max.handleChanges(changes);
    const keys = hist && Object.keys(hist);

    for (const key in changes) {
      const prevItem = this._lastChangesItem[key];
      if (prevItem)
        prevItem.dehighlight(key);

      this._lastChangesItem[key] = item;
    }

    if (Array.isArray(keys) && keys.length) {
      for (const i of this.items) {
        for (const key of keys) {
          if (hist[key] == null || i[key].component != 'histogram')
            continue;

          (i[key] as HistogramCell).calcHist(hist[key]);
        }
      }
    }
  }

  afterDraw = (e, grid) => {
    grid.forEachRow((row, y) => {
      if (!row.isCenter)
        return;

      const ctx = e.ctx;
      const width = e.ctx.canvas.width;
      const rowHeight = grid.style.rowHeight;
      y += rowHeight;

      ctx.beginPath();
      ctx.strokeStyle = this._settings.common?.generalColors?.centerLineColor;
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    });
  }

  handleNodeEvent(name: LayoutNodeEvent, data: any) {
    switch (name) {
      case LayoutNodeEvent.Resize:
      case LayoutNodeEvent.Show:
      case LayoutNodeEvent.Open:
      case LayoutNodeEvent.Maximize:
      case LayoutNodeEvent.Restore:
        this._handleResize();
        break;
      case LayoutNodeEvent.Event:
        this._handleKey(data);
    }
    return true;
  }

  private _handleKey(event) {
    if (!(event instanceof KeyboardEvent)) {
      return;
    }

    console.log('keysStack', this.keysStack.hashCode());

    this.keysStack.handle(event);
    const keyBinding = Object.entries(this._settings.hotkeys)
      .map(([name, item]) => [name, KeyBinding.fromDTO(item as any)])
      .find(([name, binding]) => (binding as KeyBinding).equals(this.keysStack));

    if (keyBinding) {
      this.domKeyHandlers[keyBinding[0] as string]();
    }
  }

  @SynchronizeFrames()
  private _handleResize(afterResize?: Function) {
    const visibleRows = this.dataGrid.getVisibleRows();
    this.visibleRows = visibleRows;

    this.dataGrid.resize();
    if (afterResize)
      afterResize();
  }

  saveState?(): IDomState {
    return {
      instrument: this.instrument,
      settings: this._settings.toJson()
    };
  }

  loadState?(state: IDomState) {
    this._settings = state?.settings ? DomSettings.fromJson(state.settings) : new DomSettings();
    this._settings.columns = this.columns;
    // this.openSettings(true);

    // for debug purposes
    if (!state)
      state = {} as any;

    if (!state?.instrument)
      state.instrument = {
        id: 'ESH1',
        description: 'E-Mini S&P 500',
        exchange: 'CME',
        tickSize: 0.25,
        precision: 2,
        symbol: 'ESH1',
      };
    // for debug purposes


    if (!state?.instrument)
      return;

    this.instrument = state.instrument;
  }

  openSettings(hidden = false) {
    this.layout.addComponent({
      component: {
        name: DomSettingsSelector,
        state: this._settings,
      },
      closeBtn: true,
      single: true,
      width: 680,
      resizable: false,
      removeIfExists: true,
      hidden,
    });
  }

  private _createOrder(column: string, item: DomItem) {
    if (this.isTradingLocked)
      return;

    console.log(column, item);
    if (!this._domForm.valid) {
      this.notifier.showError('Please fill all required fields in form');
      return;
    }

    const side = column === Columns.AskDelta ? OrderSide.Sell : OrderSide.Buy;
    const price = item.price._value;
    const form = this._domForm.getDto();
    const { exchange, symbol } = this.instrument;

    form.stopPrice = price;
    form.limitPrice = price;

    this._ordersRepository.createItem({
      ...form,
      exchange,
      side,
      symbol,
      accountId: this._accountId,
    }).subscribe(
      (res) => this.notifier.showSuccess('Order successfully created'),
      (err) => this.notifier.showError(err)
    );
  }

  private _normalizePrice(price) {
    const tickSize = this._tickSize;
    return +(Math.round(price / tickSize) * tickSize).toFixed(this.instrument.precision);
  }

  ngOnDestroy() {
    super.ngOnDestroy();
    const instrument = this.instrument;
    if (!instrument)
      return;

    this._levelOneDatafeed.unsubscribe(instrument);
    this._levelTwoDatafeed.unsubscribe(instrument);
  }
}


export function sum(num1, num2, step = 1) {
  step = Math.pow(10, step);
  return (Math.round(num1 * step) + Math.round(num2 * step)) / step;
}

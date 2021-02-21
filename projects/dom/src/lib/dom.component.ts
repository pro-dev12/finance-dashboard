import { AfterViewInit, Component, ElementRef, Injector, OnInit, ViewChild } from '@angular/core';
import { untilDestroyed } from '@ngneat/until-destroy';
import { AccountsManager } from 'accounts-manager';
import { convertToColumn, LoadingComponent } from 'base-components';
import { RealtimeActionData } from 'communication';
import {
  CellClickDataGridHandler,
  ContextMenuClickDataGridHandler,
  DataGrid,
  IFormatter,
  MouseUpDataGridHandler,
  RoundFormatter
} from 'data-grid';
import { KeyBinding, KeyboardListener } from 'keyboard';
import { ILayoutNode, IStateProvider, LayoutNode, LayoutNodeEvent } from 'layout';
import { Id } from 'projects/communication';
import { MouseDownDataGridHandler } from 'projects/data-grid';
import { RealPositionsRepository } from 'real-trading';
import {
  IConnection,
  IInstrument,
  IOrder,
  IPosition,
  IQuote,
  L2,
  Level1DataFeed,
  Level2DataFeed,
  OrderBooksRepository,
  OrdersFeed,
  OrderSide,
  OrdersRepository,
  OrderStatus,
  OrderType,
  PositionsFeed,
  PositionsRepository,
  QuoteSide,
  Side, TradeDataFeed,
  TradePrint, UpdateType, VolumeHistoryRepository
} from 'trading';
import { DomFormComponent, FormActions, OcoStep } from './dom-form/dom-form.component';
import { DomSettingsSelector } from './dom-settings/dom-settings.component';
import { DomSettings } from './dom-settings/settings';
import { DomItem } from './dom.item';
import { HistogramCell } from './histogram/histogram.cell';

export interface DomComponent extends ILayoutNode, LoadingComponent<any, any> {
}

export class DomItemMax {
  ask: number;
  bid: number;
  askDelta: number;
  bidDelta: number;
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
    this.askDelta = null;
    this.bidDelta = null;
  }
}

const ROWS = 400;
const DOM_HOTKEYS = 'domHotkeys';

interface IDomState {
  instrument: IInstrument;
  settings?: any;
  componentInstanceId: number,
}

const directionsHints = {
  'window-left': 'Left View',
  'full-screen-window': 'Horizontal View',
  'window-right': 'Right View',
};
const topDirectionIndex = 1;

enum Columns {
  Bid = 'bid',
  Ask = 'ask',
  AskDelta = 'askDelta',
  BidDelta = 'bidDelta',
  Orders = 'orders',
  All = 'all',
}

export enum QuantityPositions {
  FIRST = 0,
  SECOND = 2,
  THIRD = 3,
  FORTH = 4,
  FIFTH = 5,
}

const OrderColumns = [Columns.AskDelta, Columns.BidDelta, Columns.Orders];

@Component({
  selector: 'lib-dom',
  templateUrl: './dom.component.html',
  styleUrls: ['./dom.component.scss'],
})
@LayoutNode()
export class DomComponent extends LoadingComponent<any, any> implements OnInit, AfterViewInit, IStateProvider<IDomState> {
  columns = [];

  keysStack: KeyboardListener = new KeyboardListener();
  buyOcoOrder: IOrder;
  sellOcoOrder: IOrder;
  ocoStep = OcoStep.None;
  private currentCell;
  positions: IPosition[] = [];

  domKeyHandlers = {
    autoCenter: () => this.centralize(),
    autoCenterAllWindows: () => this.broadcastHotkeyCommand('autoCenter'),
    buyMarket: () => this._createOrder(OrderSide.Buy, null, { type: OrderType.Market }),
    sellMarket: () => this._createOrder(OrderSide.Sell, null, { type: OrderType.Market }),
    hitBid: () => {
      this._createOrderByCurrent(OrderSide.Sell, '_bestBidPrice');
    },
    joinBid: () => {
      this._createOrderByCurrent(OrderSide.Buy, '_bestBidPrice');
    },
    liftOffer: () => {
      this._createOrderByCurrent(OrderSide.Buy, '_bestAskPrice');
    },
    joinAsk: () => {
      this._createOrderByCurrent(OrderSide.Sell, '_bestAskPrice');
    },
    oco: () => {
      this.handleFormAction(FormActions.CreateOcoOrder);
    },
    flatten: () => this.handleFormAction(FormActions.Flatten),
    cancelAllOrders: () => this.handleFormAction(FormActions.CloseOrders),
    quantity1: () => this._handleQuantitySelect(QuantityPositions.FIRST),
    quantity2: () => this._handleQuantitySelect(QuantityPositions.SECOND),
    quantity3: () => this._handleQuantitySelect(QuantityPositions.THIRD),
    quantity4: () => this._handleQuantitySelect(QuantityPositions.FORTH),
    quantity5: () => this._handleQuantitySelect(QuantityPositions.FIFTH),
    quantityToPos: () => {
      this._domForm.positionsToQuantity();
    },
    stopsToPrice: () => {
      this.allStopsToPrice();
    },
    stopsToLimit: () => {
      this.allLimitToPrice();
    },
    clearAlerts: () => {
    },
    clearAlertsAllWindow: () => {
    },
    clearAllTotals: () => {
      for (const item of this.items) {
        item.totalBid.clear();
        item.totalAsk.clear();
      }
    },
    clearCurrentTrades: () => {
      for (const item of this.items) {
        item.currentBid.clear();
        item.currentAsk.clear();
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
      for (const item of this.items) {
        item.volume.clear();
      }
    }
  };

  @ViewChild(DomFormComponent)
  private _domForm: DomFormComponent;
  draggingOrders: IOrder[] = [];
  draggingDomItemId: Id;

  handlers = [
    ...[Columns.Ask, Columns.Bid].map(column => (
      new CellClickDataGridHandler<DomItem>({
        column, handler: (item) => this._createOrderByClick(column, item),
      })
    )),
    ...OrderColumns.map(column => (
      new ContextMenuClickDataGridHandler<DomItem>({
        column, handler: (item) => this._cancelOrderByClick(column, item),
      })
    )),
    ...OrderColumns.map(column =>
      new MouseDownDataGridHandler<DomItem>({
        column, handler: (item) => {
          const orders = item.orders.orders;
          if (orders.length) {
            this.draggingDomItemId = item.id;
            this.draggingOrders = orders;
          }
        },
      })),
    ...OrderColumns.map(column => new MouseUpDataGridHandler<DomItem>({
      column, handler: (item) => {
        if (this.draggingDomItemId && this.draggingDomItemId !== item.id) {
          this._setPriceForOrders(this.draggingOrders, +item.price.value);
        }
        this.draggingDomItemId = null;
        this.draggingOrders = [];
      }
    }))
  ];

  private _accountId: string;

  get accountId() {
    return this._accountId;
  }

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

  private _max = new DomItemMax();
  private _lastChangesItem: { [key: string]: DomItem } = {};

  private _map = new Map<number, DomItem>();

  private get _lastPrice(): number {
    return this._lastChangesItem.ltq?.lastPrice;
  }

  private _lastTrade: TradePrint;

  get trade() {
    return this._lastTrade;
  }

  private _settings: DomSettings = new DomSettings();

  get domFormSettings() {
    return this._settings.orderArea.formSettings;
  }

  private _customTickSize;

  private set _tickSize(value: number) {
    this._customTickSize = value;
  }

  private get _tickSize() {
    return this._customTickSize ?? this.instrument.tickSize ?? 0.25;
  }

  private _bestAskPrice: number;
  private _bestBidPrice: number;
  componentInstanceId: number;

  constructor(
    private _ordersRepository: OrdersRepository,
    private _positionsRepository: PositionsRepository,
    private _orderBooksRepository: OrderBooksRepository,
    private _ordersFeed: OrdersFeed,
    private _positionsFeed: PositionsFeed,
    private _levelOneDatafeed: Level1DataFeed,
    private _tradeDatafeed: TradeDataFeed,
    protected _accountsManager: AccountsManager,
    private _levelTwoDatafeed: Level2DataFeed,
    private _volumeHistoryRepository: VolumeHistoryRepository,
    protected _injector: Injector
  ) {
    super();
    this.componentInstanceId = Date.now();
    this.setTabIcon('icon-widget-dom');
    (window as any).dom = this;

    this.columns = [
      ...[
        // '_id',
        'orders',
        ['volume', 'volume', 'histogram'],
        'price',
        ['bidDelta', 'delta'],
        ['bid', 'bid', 'histogram'],
        'ltq',
        ['currentBid', 'c.bid', 'histogram'],
        ['currentAsk', 'c.ask', 'histogram'],
        ['ask', 'ask', 'histogram'],
        ['askDelta', 'delta'],
        ['totalBid', 't.bid', 'histogram'],
        ['totalAsk', 't.ask', 'histogram'],
        // 'tradeColumn',
        // 'askDepth',
      ].map(convertToColumn),
      {
        name: 'notes',
        style: {
          textOverflow: true,
          textAlign: 'left',
        },
        title: 'NOTES',
        visible: true
      }
    ];
  }

  ngOnInit(): void {
    super.ngOnInit();
    this._accountsManager.connections
      .pipe(untilDestroyed(this))
      .subscribe(() => {
        const connection = this._accountsManager.getActiveConnection();
        this._ordersRepository = this._ordersRepository.forConnection(connection);
        this._positionsRepository = this._positionsRepository.forConnection(connection);
        this._orderBooksRepository = this._orderBooksRepository.forConnection(connection);
        this._volumeHistoryRepository = this._volumeHistoryRepository.forConnection(connection);

        if (connection)
          this._onInstrumentChange();
      });
    this._positionsFeed.on((pos) => {
      this.handlePosition(pos);
    });
    this._ordersRepository.actions
      .pipe(untilDestroyed(this))
      .subscribe((action) => this._handleOrdersRealtime(action));
    this.onRemove(
      this._levelOneDatafeed.on((item: IQuote) => this._handleQuote(item)),
      this._ordersFeed.on((trade: IOrder) => this._handleOrders([trade])),
      this._levelTwoDatafeed.on((item: L2) => this._handleL2(item)),
      this._tradeDatafeed.on((item: TradePrint) => this._handleTrade(item)),
    );
    this.addLinkObserver({
      link: DOM_HOTKEYS,
      handleLinkData: (key: string) => this.handleHotkey(key),
    });
    this.addLinkObserver({
      link: DomSettingsSelector + this.componentInstanceId,
      handleLinkData: (settings: DomSettings) => {
        const common = settings.common;
        if (common) {
          for (const column of this.columns) {
            column.visible = common[column.name] != false;
          }
        }
        const general = settings?.general;
        this.dataGrid.applyStyles({
          font: `${common.fontWeight || ''} ${common.fontSize}px ${common.fontFamily}`,
          gridBorderColor: common.generalColors.gridLineColor,
          scrollSensetive: general.intervals.scrollWheelSensitivity,
        });
        const minToVisible = general?.marketDepth?.bidAskDeltaFilter ?? 0;
        const clearTradersTimer = general.intervals.clearTradersTimer ?? 0;
        const overlayOrders = settings.order.overlay;
        this._tickSize = general.commonView.ticksPerPrice;

        settings.bidDelta.minToVisible = minToVisible;
        settings.askDelta.minToVisible = minToVisible;
        settings.currentAsk.clearTradersTimer = clearTradersTimer;
        settings.currentBid.clearTradersTimer = clearTradersTimer;
        settings.bidDelta.overlayOrders = overlayOrders;
        settings.askDelta.overlayOrders = overlayOrders;

        this._settings.merge(settings);
        this._applyOffset(this._lastPrice);
        this.items.forEach(i => i.refresh());
        this.detectChanges(true);
      }
    });
  }

  allStopsToPrice() {
    this._setPriceForAllOrders(OrderType.StopMarket);
  }

  allLimitToPrice() {
    this._setPriceForAllOrders(OrderType.Limit);
  }

  _setPriceForAllOrders(type: OrderType) {
    const row = this.currentCell.row;
    if (row) {
      // #TODO investigate what side should be if row is in center
      const side = row.isBelowCenter ? OrderSide.Buy : OrderSide.Sell;
      const orders = this.items.reduce((total, item) => {
        return total.concat(item.orders.orders.filter(order => {
          return order.type === type && order.side === side;
        }));
      }, []);
      const price = +row.price.value;
      this._setPriceForOrders(orders, price);
    }
  }

  _setPriceForOrders(orders, price) {
    orders.map(item => {
      const priceTypes = this._getPriceSpecs(item, price);

      return {
        quantity: item.quantity,
        type: item.type,
        ...priceTypes,
        duration: item.duration,
        orderId: item.id,
        accountId: item.account.id,
        symbol: item.instrument.symbol,
        exchange: item.instrument.exchange,
      };
    }).map(item => this._ordersRepository.updateItem(item).toPromise());
  }

  // #TODO need test
  private _createOrderByCurrent(side: OrderSide, from: '_bestBidPrice' | '_bestAskPrice') {
    const price = this[from];
    if (price)
      this._createOrder(side, +price);
  }

  handleHotkey(key) {
    this.domKeyHandlers[key]();
  }

  handlePosition(pos) {
    if (pos.instrument.symbol !== this.instrument.symbol)
      return;
    const newPosition = RealPositionsRepository.transformPosition(pos);
    const oldPosition = this.positions.find(item => item.id === newPosition.id);
    const {
      closeOutstandingOrders,
    } = this._settings.general;
    const isNewPosition = !oldPosition || (diffSize(oldPosition) == 0 && diffSize(newPosition) !== diffSize(oldPosition));
    if (isNewPosition) {
      // #TODO test all windows
      this.applySettingsOnNewPosition();
    } else {
      if (closeOutstandingOrders && oldPosition?.side !== Side.Closed
        && newPosition.side === Side.Closed) {
        this.deleteOutstandingOrders();
      }
    }
    if (oldPosition) {
      const index = this.positions.findIndex(item => item.id === newPosition.id);
      this.positions[index] = newPosition;
    } else {
      this.positions.push(newPosition);
    }
  }

  applySettingsOnNewPosition() {
    const {
      recenter,
      clearCurrentTrades,
      clearTotalTrades,
      allWindows
    } = this._settings.general;
    if (clearCurrentTrades) {
      if (allWindows) {
        this.domKeyHandlers.clearCurrentTradesAllWindows();
      } else
        this.domKeyHandlers.clearCurrentTrades();
    }
    if (clearTotalTrades) {
      if (allWindows) {
        this.domKeyHandlers.clearTotalTradesDownAllWindows();
        this.domKeyHandlers.clearTotalTradesUpAllWindows();
      } else {
        this.domKeyHandlers.clearTotalTradesDown();
        this.domKeyHandlers.clearTotalTradesUp();
      }
    }
    if (recenter) {
      if (allWindows) {
        this.domKeyHandlers.autoCenterAllWindows();
      } else {
        this.domKeyHandlers.autoCenter();
      }
    }
  }

  deleteOutstandingOrders() {
    const orders = this.items.reduce((acc, i) => ([...acc, ...i.orders.orders]), [])
      .filter(item => item.status === OrderStatus.Pending);
    this._ordersRepository.deleteMany(orders)
      .pipe(untilDestroyed(this))
      .subscribe((res) => {
        this.notifier.showSuccess('Success');
      }, (err) => this.notifier.showError(err));
  }

  _handleOrdersRealtime(action: RealtimeActionData<IOrder>) {
    if (action.items)
      this._handleOrders(action.items);

    this.detectChanges();
  }

  _onInstrumentChange() {
    const instrument = this.instrument;
    this._priceFormatter = new RoundFormatter(instrument?.precision ?? 2);
    this._levelOneDatafeed.subscribe(instrument);
    this._levelTwoDatafeed.subscribe(instrument);
    this._tradeDatafeed.subscribe(instrument);

    this._loadData();
  }

  protected _loadVolumeHistory() {
    if (!this._accountId || !this._instrument)
      return;

    const { symbol, exchange } = this._instrument;
    this._volumeHistoryRepository.getItems({ symbol, exchange }).subscribe(
      res => {
        for (const vol of res.data) {
          const item = this._getItem(vol.price);
          this._handleMaxChange(item.setVolume(vol.volume), item);
        }
      },
      error => this.notifier.showError(error)
    );
  }

  protected _loadOrderBook() {
    if (!this._accountId || !this._instrument)
      return;

    // const { symbol, exchange } = this._instrument;
    // this._orderBooksRepository.getItems({ symbol, exchange }).subscribe(
    //   res => {
    //     this._clear();
    //
    //     const { asks, bids } = res.data[0];
    //
    //     bids.sort((a, b) => a.price - b.price);
    //     asks.sort((a, b) => b.price - a.price);
    //
    //     if (!asks.length && !bids.length)
    //       return;
    //
    //     let index = 0;
    //     let price = this._normalizePrice(asks[asks.length - 1].price);
    //     const tickSize = this._tickSize;
    //     const minPrice = bids[0].price;
    //     const maxPrice = asks[0].price;
    //     const maxRows = ROWS * 2;
    //
    //     while (index < maxRows && (price <= maxPrice || index < ROWS)) {
    //       this.items.unshift(this._getItem(price));
    //       price = this._normalizePrice(price + tickSize);
    //       index++;
    //     }
    //
    //     index = 0;
    //     price = this._normalizePrice(asks[asks.length - 1].price - tickSize);
    //
    //     while (index < maxRows && (price >= minPrice || index < ROWS)) {
    //       this.items.push(this._getItem(price));
    //       price = this._normalizePrice(price - tickSize);
    //       index++;
    //     }
    //
    //     const instrument = this.instrument;
    //     asks.forEach((info) => this._handleQuote({
    //       instrument,
    //       price: info.price,
    //       timestamp: 0,
    //       volume: info.volume,
    //       side: QuoteSide.Ask
    //     } as IQuote));
    //     bids.forEach((info) => this._handleQuote({
    //       instrument,
    //       price: info.price,
    //       timestamp: 0,
    //       volume: info.volume,
    //       side: QuoteSide.Bid
    //     } as IQuote));
    //
    //     for (const i of this.items) {
    //       if (i.clearDelta)
    //         i.clearDelta();
    //       i.dehighlight(Columns.All);
    //     }

        this._loadOrders();
        this._loadVolumeHistory();
    //   },
    //   error => this.notifier.showError(error)
    // );
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
    );
  }

  private _handleOrders(orders: IOrder[]) {
    for (const order of orders) {
      if (order.instrument.symbol !== this.instrument.symbol || order.instrument.exchange != this.instrument.exchange)
        continue;
      const oldItem = this.items.forEach(item => {
        item.removeOrder(order);
      });
      const item = this._getItem(order.limitPrice || order.stopPrice);
      if (!item)
        continue;
      item.handleOrder(order);
    }

    this.detectChanges(true);
  }

  handleAccountChange(account: string) {
    this._accountId = account;
    this._loadData();
  }

  protected _loadData() {
    if (!this._accountId || !this._instrument)
      return;

    this._loadPositions();
    this._loadOrderBook();
  }

  protected _loadPositions() {
    this._positionsRepository.getItems({ accountId: this._accountId })
      .pipe(untilDestroyed(this))
      .subscribe(items => this.positions = items.data);
  }

  broadcastHotkeyCommand(commandName: string) {
    this.broadcastData(DOM_HOTKEYS, commandName);
  }

  forUpItems(handler: (data) => void) {
    let emit = true;
    for (const item of this.items) {
      if (item.isCenter)
        emit = false;

      if (emit)
        handler(item);
    }
  }

  forDownItems(handler: (item) => void) {
    let emit = false;
    for (const item of this.items) {
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
      let index = ROWS / 2;

      if (this._lastPrice) {
        for (let i = 0; i < this.items.length; i++) {
          const item = this.items[i];
          item.isCenter = item.lastPrice === this._lastPrice;
          if (item.isCenter)
            index = i;
        }
        for (let i = 0; i < this.items.length; i++) {
          const item = this.items[i];
          item.isAboveCenter = i < index;
          item.isBelowCenter = i > index;
        }
      }

      grid.scrollTop = index * grid.rowHeight - visibleRows / 2 * grid.rowHeight;
    });
    this.detectChanges();
  }

  detectChanges(force = false) {
    this.dataGrid.detectChanges(force);
  }

  private _getItem(price: number): DomItem {
    let item = this._map.get(price);
    if (!item) {
      item = new DomItem(price, this._settings, this._priceFormatter);
      this._map.set(price, item);
      item.setPrice(price);
    }

    return item;
  }

  private _clear() {
    this.items = [];
    this._map.clear();
    this._max.clear();
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

  protected _handleTrade(trade: TradePrint) {
    if (trade.instrument?.symbol !== this.instrument?.symbol) return;

    const changes = this._lastChangesItem;
    const prevltqItem = changes.ltq;
    console.log('_handleTrade', prevltqItem?.lastPrice, trade.timestamp, trade.price, trade.volume);

    if (prevltqItem?.lastPrice !== trade.price) {
      if (prevltqItem)
        prevltqItem.clearLTQ();

      this._applyOffset(trade.price);
    }

    const _item = this._getItem(trade.price);
    this._handleMaxChange(_item.handleTrade(trade), _item);

    if (!this.items.length)
      this.fillData();

    if (!prevltqItem)
      this.centralize();

    this._lastTrade = trade;
    this.detectChanges();
  }

  fillData() {
    this.items = [];
    this._map.clear();
    this._max.clear()
    const data = this.items;
    const tickSize = this._tickSize;
    const lastPrice = this._lastPrice;

    let price = this._normalizePrice(lastPrice - tickSize * ROWS / 2);
    const maxPrice = this._normalizePrice(lastPrice + tickSize * ROWS / 2);

    while (price < maxPrice) {
      price = this._normalizePrice(price += tickSize);
      data.unshift(this._getItem(price));
    }

    this.centralize();
  }

  private _applyOffset(centerPrice: number) {
    // const index = this.items.findIndex(i => i.lastPrice === centerPrice);

    // if (index === -1)
    //   return;

    // const depth = this._settings.general?.marketDepth;
    // const marketDepth = depth?.marketDepth ?? 10000;
    // const marketDeltaDepth = depth?.bidAskDeltaDepth ?? 10000;
    // const items = this.items;

    // let changes;
    // let up = index;
    // let down = index - 1;

    // this._max.bid = null;
    // this._max.ask = null;
    // this._max.bidDelta = null;
    // this._max.askDelta = null;
    // let item;

    // while (--up >= 0) {
    //   item = items[up];
    //   item.clearDelta();
    //   item.clearBid();

    //   changes = item.setAskVisibility(index - marketDepth > up, index - marketDeltaDepth > up);

    //   if (changes === true)
    //     break;

    //   this._handleMaxChange(changes, item);
    // }

    // while (++down < items.length) {
    //   item = items[down];
    //   item.clearDelta();
    //   item.clearAsk();
    //   changes = item.setBidVisibility(down - index > marketDepth, down - index > marketDeltaDepth);

    //   if (changes === true)
    //     break;

    //   this._handleMaxChange(changes, item);
    // }
  }


  protected _handleQuote(trade: IQuote) {
    if (trade.instrument?.symbol !== this.instrument?.symbol) return;

    const item = this._getItem(trade.price);
    console.log('_handleQuote', trade.side, trade.timestamp, trade.updateType, trade.price, trade.volume);

    this._handleMaxChange(item.handleQuote(trade), item);

    if (trade.updateType === UpdateType.Undefined) {
      const depth = this._settings.general?.marketDepth;
      const marketDepth = depth?.marketDepth ?? 10000;
      const marketDeltaDepth = depth?.bidAskDeltaDepth ?? 10000;
      let items = this.items;
      let item;
      let index;
      let changes;
      let price = trade.price;

      if (trade.side === QuoteSide.Bid) {
        if (this._bestAskPrice != price) {

          for (let i = items.length - 1; i >= 0; i--) {
            item = items[i];
            item.clearAskDelta();
            if (item.lastPrice < price) {
              item.clearAsk();
            } else {
              if (item.lastPrice == price)
                index = i;

              changes = item.setAskVisibility(i - marketDepth > index, i - marketDeltaDepth > index);

              if (changes === true)
                break;

              this._handleMaxChange(changes, item);
            }
          }

          this._bestAskPrice = price;
        }
      } else {
        if (this._bestBidPrice != price) {

          for (let i = 0; i < items.length; i++) {
            item = items[i];
            item.clearBidDelta();
            if (item.lastPrice > price) {
              item.clearBid();
            } else {
              if (item.lastPrice == price)
                index = i;

              changes = item.setBidVisibility(i - index > marketDepth, i - index > marketDeltaDepth);

              if (changes === true)
                break;

              this._handleMaxChange(changes, item);
            }
          }

          this._bestBidPrice = price;
        }
      }
    }

    this.detectChanges();
  }

  protected _handleL2(l2: L2) {
    // if (l2.instrument?.symbol !== this.instrument?.symbol) return;

    // const item = this._getItem(l2.price);
    // this._handleMaxChange(item.handleL2(l2), item);
    // this.detectChanges();
  }

  private _handleMaxChange(changes: any, item: DomItem) {
    const hist = this._max.handleChanges(changes);
    const keys = hist && Object.keys(hist);

    for (const key in changes) {
      if (changes.hasOwnProperty(key)) {
        const prevItem = this._lastChangesItem[key];
        if (prevItem)
          prevItem.dehighlight(key);

        this._lastChangesItem[key] = item;
      }
    }

    if (Array.isArray(keys) && keys.length) {
      for (const i of this.items) {
        for (const key of keys) {
          if (hist[key] == null || i[key].component !== 'histogram')
            continue;

          (i[key] as HistogramCell).calcHist(hist[key]);
        }
      }
    }
  }

  afterDraw = (e, grid) => {
    if (!this._settings.general.centerLine)
      return;

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

  transformLabel(label: string) {
    const replacer = '*';
    const { hideAccountName, hideFromLeft, hideFromRight, digitsToHide } = this._settings.general;
    if (hideAccountName) {

      if (hideFromLeft && hideFromRight && (digitsToHide * 2) >= label.length) {
        return replacer.repeat(label.length);
      }
      if ((hideFromLeft || hideFromRight) && digitsToHide >= label.length) {
        return replacer.repeat(label.length);
      }
      let _label = label;
      if (hideFromLeft)
        _label = replacer.repeat(digitsToHide) + _label.substring(digitsToHide, label.length);
      if (hideFromRight)
        _label = _label.substring(0, label.length - digitsToHide) + replacer.repeat(digitsToHide);
      return _label;
    }
    return label;
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

    this.keysStack.handle(event);
    console.log('this.keysStack', this.keysStack.hashCode());
    const keyBinding = Object.entries(this._settings.hotkeys)
      .map(([name, item]) => [name, KeyBinding.fromDTO(item as any)])
      .find(([name, binding]) => (binding as KeyBinding).equals(this.keysStack));

    if (keyBinding) {
      console.warn(keyBinding[0]);
      this.domKeyHandlers[keyBinding[0] as string]();
    }
  }

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
      componentInstanceId: this.componentInstanceId,
      settings: this._settings.toJson()
    };
  }

  loadState?(state: IDomState) {
    this._settings = state?.settings ? DomSettings.fromJson(state.settings) : new DomSettings();
    this._settings.columns = this.columns;
    if (state?.componentInstanceId)
      this.componentInstanceId = state.componentInstanceId;
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
        state: { settings: this._settings, componentInstanceId: this.componentInstanceId },
      },
      closeBtn: true,
      single: true,
      width: 618,
      resizable: false,
      removeIfExists: true,
      hidden,
    });
  }

  private _createOrder(side: OrderSide, price?: number, orderConfig: Partial<IOrder> = {}) {
    if (this.isTradingLocked)
      return;


    if (!this._domForm.valid) {
      this.notifier.showError('Please fill all required fields in form');
      return;
    }

    const form = this._domForm.getDto();
    const { exchange, symbol } = this.instrument;
    // #TODO need test
    const priceSpecs = this._getPriceSpecs({ ...form, side }, price);
    this._ordersRepository.createItem({
      ...form,
      ...priceSpecs,
      ...orderConfig,
      exchange,
      side,
      symbol,
      accountId: this._accountId,
    }).subscribe(
      (res) => console.log('Order successfully created'),
      (err) => this.notifier.showError(err)
    );
  }

  private _createOrderByClick(column: string, item: DomItem) {
    const side = column === Columns.Ask ? OrderSide.Sell : OrderSide.Buy;
    if (this.ocoStep === OcoStep.None) {
      this._createOrder(side, item.price._value);
    } else {
      this._addOcoOrder(side, item);
    }
  }

  private _addOcoOrder(side, item: DomItem) {
    if (!this.buyOcoOrder && side === OrderSide.Buy) {
      item.createOcoOrder(side, this._domForm.getDto());
      const order = { ...this._domForm.getDto(), side };
      const specs = this._getPriceSpecs(order, +item.price.value);
      this.buyOcoOrder = { ...order, ...specs };
      this._createOcoOrder();
    }
    if (!this.sellOcoOrder && side === OrderSide.Sell) {
      item.createOcoOrder(side, this._domForm.getDto());
      const order = { ...this._domForm.getDto(), side };
      const specs = this._getPriceSpecs(order, +item.price.value);
      this.sellOcoOrder = { ...order, ...specs };
      this._createOcoOrder();
    }
  }

  _getPriceSpecs(item: IOrder & { amount: number }, price) {
    const priceSpecs: any = {};
    if ([OrderType.Limit, OrderType.StopLimit].includes(item.type)) {
      priceSpecs.limitPrice = price;
    }
    if ([OrderType.StopMarket, OrderType.StopLimit].includes(item.type)) {
      priceSpecs.stopPrice = price;
    }
    if (item.type === OrderType.StopLimit) {
      const offset = this._tickSize * item.amount;
      priceSpecs.limitPrice = price + (item.side === OrderSide.Sell ? -offset : offset);
    }
    return priceSpecs;
  }

  private _createOcoOrder() {
    this.ocoStep = this.ocoStep === OcoStep.None ? OcoStep.Fist : OcoStep.Second;
    if (this.buyOcoOrder && this.sellOcoOrder) {
      this.buyOcoOrder.ocoOrder = this.sellOcoOrder;
      this._ordersRepository.createItem(this.buyOcoOrder)
        .pipe(untilDestroyed(this))
        .subscribe(() => {
          this._clearOcoOrders();
        });
    }
  }

  private _cancelOrderByClick(column: string, item: DomItem) {
    if (!item[column]?.canCancelOrder)
      return;

    if (item.orders?.orders?.length)
      this._ordersRepository.deleteMany(item.orders.orders).subscribe(
        () => console.log('delete order'),
        (error) => this.notifier.showError(error),
      );
  }

  handleFormAction(action: FormActions) {
    switch (action) {
      case FormActions.CloseOrders:
      case FormActions.CloseBuyOrders:
      case FormActions.CloseSellOrders:
        this._closeOrders(action);
        break;
      case FormActions.ClosePositions:
        this._closePositions();
        break;
      case FormActions.Flatten:
        this._closeOrders(FormActions.CloseOrders);
        this._closePositions();
        break;
      case FormActions.CreateOcoOrder:
        if (this.ocoStep === OcoStep.None)
          this.ocoStep = OcoStep.Fist;
        break;
      case FormActions.CancelOcoOrder:
        this._clearOcoOrders();
        break;
      case FormActions.CreateMarketOrder:
        this._createMarketOrder();
        break;
      default:

        console.error('Undefined action');
    }
  }

  _clearOcoOrders() {
    this.ocoStep = OcoStep.None;
    this.sellOcoOrder = null;
    this.buyOcoOrder = null;
    this.items.forEach(item => item.clearOcoOrder());
  }

  _createMarketOrder() {
    const data = this._domForm.getDto();
    const { exchange, symbol } = this.instrument;
    // #TODO investigate what side of order should be added.
    this._ordersRepository.createItem({
      ...data,
      accountId: this._accountId,
      type: OrderType.Market,
      side: OrderSide.Buy, exchange, symbol
    })
      .toPromise()
      .then(() => {
        this.notifier.showSuccess('Order Created');
      }).catch((err) => {
      this.notifier.showError(err);
    });
  }

  private _closePositions() {
    this._positionsRepository.deleteMany({
      accountId: this._accountId,
      ...this._instrument,
    }).subscribe(
      () => console.log('_closePositions'),
      (error) => this.notifier.showError(error),
    );
  }

  private _closeOrders(action: FormActions) {
    let orders = this.items.reduce((acc, i) => ([...acc, ...i.orders.orders]), []);

    if (action === FormActions.CloseSellOrders)
      orders = orders.filter(i => i.side === OrderSide.Sell);
    else if (action === FormActions.CloseBuyOrders)
      orders = orders.filter(i => i.side === OrderSide.Buy);

    this._ordersRepository.deleteMany(orders).subscribe(
      () => console.log('delete many'),
      (error) => this.notifier.showError(error),
    );
  }

  private _normalizePrice(price) {
    const tickSize = this._tickSize;
    return +(Math.round(price / tickSize) * tickSize).toFixed(this.instrument.precision);
  }

  private _handleQuantitySelect(position: number): void {
    this._domForm.selectQuantityByPosition(position);
  }

  ngOnDestroy() {
    super.ngOnDestroy();
    const instrument = this.instrument;
    if (!instrument)
      return;

    this._levelOneDatafeed.unsubscribe(instrument);
    this._levelTwoDatafeed.unsubscribe(instrument);
    this._tradeDatafeed.unsubscribe(instrument);
  }

  onCurrentCellChanged($event: any) {
    this.currentCell = $event;
  }
}

function diffSize(position: IPosition) {
  return position.buyVolume - position.sellVolume;
}


export function sum(num1, num2, step = 1) {
  step = Math.pow(10, step);
  return (Math.round(num1 * step) + Math.round(num2 * step)) / step;
}

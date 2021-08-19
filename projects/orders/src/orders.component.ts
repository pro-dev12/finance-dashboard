import { AfterViewInit, Component, HostBinding, Injector, OnDestroy, ViewChild } from '@angular/core';
import {
  convertToColumn,
  HeaderItem,
  ISettingsApplier,
  RealtimeGridComponent,
  SettingsApplier,
  ViewGroupItemsBuilder
} from 'base-components';
import { OrderColumn, OrderItem } from 'base-order-form';
import { IPaginationResponse } from 'communication';
import {
  CellClickDataGridHandler,
  CellStatus,
  CheckboxCell,
  Column,
  DataGrid,
  DataGridHandler,
  DateTimeFormatter,
  generateNewStatusesByPrefix
} from 'data-grid';
import { LayoutNode } from 'layout';
import { NzModalService } from 'ng-zorro-antd';
import { NotifierService } from 'notifier';
import { AccountsListener, IAccountsListener } from 'real-trading';
import { forkJoin, Observable } from 'rxjs';
import { finalize } from 'rxjs/operators';
import { Components } from 'src/app/modules';
import { IPresets, LayoutPresets, TemplatesService } from 'templates';
import {
  getPriceScecsForDuplicate,
  IAccount,
  IOrder,
  IOrderParams,
  OrdersFeed,
  OrderSide,
  OrdersRepository,
  OrderStatus,
  OrderType,
  TradeDataFeed,
  TradePrint
} from 'trading';
import { IOrdersPresets, IOrdersState } from '../models';
import { defaultSettings } from './components/orders-settings/configs';
import { ordersSettings } from './components/orders-settings/orders-settings.component';
import { GroupedOrderItem, groupStatus } from './models/grouped-order.item';

export interface OrdersComponent extends RealtimeGridComponent<IOrder, IOrderParams>, ISettingsApplier, IPresets<IOrdersState> {
}

enum Tab {
  Working,
  Filled,
  All
}

const allTypes = 'All';
const orderWorkingStatuses: OrderStatus[] = [OrderStatus.Pending, OrderStatus.New, OrderStatus.PartialFilled];

enum GroupByItem {
  None = 'none',
  AccountId = 'accountId',
  InstrumentName = 'instrumentName'
}

@Component({
  selector: 'orders-list',
  templateUrl: './orders.component.html',
  styleUrls: ['./orders.component.scss'],
})
@LayoutNode()
@LayoutPresets()
@AccountsListener()
@SettingsApplier()
export class OrdersComponent extends RealtimeGridComponent<IOrder, IOrderParams> implements OnDestroy, AfterViewInit, IAccountsListener {
  @ViewChild('grid', { static: false }) dataGrid: DataGrid;

  columns: Column[];
  orderTypes = [allTypes, ...Object.values(OrderType)];
  orderStatuses = ['Show All', ...Object.values(OrderStatus)];
  cancelMenuOpened = false;
  groupBy = GroupByItem.None;
  groupByOptions = GroupByItem;
  menuVisible = false;
  private _timeFormatter = new DateTimeFormatter();

  get isGroupSelected() {
    return this.groupBy !== GroupByItem.None;
  }

  Components = Components;

  builder = new ViewGroupItemsBuilder<IOrder, OrderItem>();
  activeTab: Tab = Tab.All;
  selectedOrders: IOrder[] = [];
  contextMenuState = {
    showHeaderPanel: true,
    showColumnHeaders: true,
  };


  defaultSettings = defaultSettings;

  gridStyles = {
    gridHeaderBorderColor: '#24262C',
    gridBorderColor: 'transparent',
    gridBorderWidth: 0,
    rowHeight: 25,
    rowOffset: 1,
  };

  private _headerCheckboxCell = new CheckboxCell();

  readonly orderType = OrderType;
  readonly tab = Tab;
  readonly headers: HeaderItem<OrderColumn>[] = [
    {
      name: OrderColumn.checkbox,
      title: ' ',
      width: 30,
      draw: this._headerCheckboxCell.draw.bind(this._headerCheckboxCell),
      hidden: true
    },
    { name: OrderColumn.accountId, title: 'ACCOUNT', tableViewName: 'Account' },
    OrderColumn.symbol,
    OrderColumn.exchange,
    OrderColumn.description,
    OrderColumn.side,
    OrderColumn.type,
    { name: OrderColumn.quantity, title: 'Quantity' },
    { name: OrderColumn.filledQuantity, title: 'QTY FILLED', tableViewName: 'Quantity Filled' },
    { name: OrderColumn.quantityRemain, title: 'QTY REMAIN', tableViewName: 'Quantity Remaining' },
    { name: OrderColumn.price, title: 'Price' },
    { name: OrderColumn.triggerPrice, title: 'TRIG Price', tableViewName: 'Trigger Price' },
    { name: OrderColumn.duration, title: 'tif', tableViewName: 'TIF' },
    { name: OrderColumn.currentPrice, title: 'Cur Price', tableViewName: 'Current Price' },
    { name: OrderColumn.timestamp, title: 'Time Placed' },
    { name: OrderColumn.averageFillPrice, title: 'AVG FILL', tableViewName: 'Average Fill Price' },
    OrderColumn.status,
    // OrderColumn.fcmId,
    // OrderColumn.ibId,
    { name: OrderColumn.identifier, title: 'ORDER ID', tableViewName: 'Order ID' },
    // OrderColumn.close,
  ];

  private componentInstanceId: number;

  get orders(): IOrder[] {
    return this.items.map(i => i.order);
  }

  // private _status: OrderStatus = OrderStatus.Pending;

  // get status() {
  //   return this._status;
  // }

  // set status(value: OrderStatus) {
  //   if (value === this.status) {
  //     return;
  //   }
  //   this._status = value;
  //   this.refresh();
  // }

  get params(): IOrderParams {
    return {
      ...this._params,
      // status: this.status
    };
  }

  handlers: DataGridHandler[] = [
    new CellClickDataGridHandler<OrderItem>({
      column: OrderColumn.close,
      handler: (data) => this.deleteItem(data.item.order),
    }),
    new CellClickDataGridHandler<OrderItem>({
      column: OrderColumn.checkbox,
      handleHeaderClick: true,
      handler: (data, event) => {
        data.item ? data.item.toggleSelect(event) : this.handleHeaderCheckboxClick(event);
        this.selectedOrders = this.items.filter(i => i.isSelected).map(i => i.order);
      },
    })
  ];

  @HostBinding('class.hide-header')
  get hideHeaderPanel() {
    return !this.contextMenuState?.showHeaderPanel;
  }

  constructor(
    protected _repository: OrdersRepository,
    protected _injector: Injector,
    protected _dataFeed: OrdersFeed,
    private _tradeDataFeed: TradeDataFeed,
    public readonly _templatesService: TemplatesService,
    public readonly _modalService: NzModalService,
    public readonly _notifier: NotifierService,
  ) {
    super();
    this.autoLoadData = false;

    this.componentInstanceId = Date.now();
    (window as any).orders = this;

    this.builder.setParams({
      order: 'asc',
      wrap: (item: IOrder) => {
        const orderItem = new OrderItem(item);
        orderItem.timeFormatter = this._timeFormatter;
        return orderItem;
      },
      groupBy: ['accountId', 'instrumentName'],
      unwrap: (item: OrderItem) => item.order,
      viewItemsFilter: null,
      addNewItems: 'start',
    });

    this.columns = this.headers.map(i => convertToColumn(i, {
      ...generateNewStatusesByPrefix({
        selectedbuyBackgroundColor: '#383A40',
        selectedsellBackgroundColor: '#383A40',
      }, CellStatus.Hovered),
      hoveredBackgroundColor: '#2B2D33',
      hoveredbuyBackgroundColor: '#2B2D33',
      hoveredsellBackgroundColor: '#2B2D33',
      [`${ groupStatus }BackgroundColor`]: '#24262C',
      [`${ groupStatus }Color`]: '#fff',
      textOverflow: true,
      textAlign: 'left',
      titleUpperCase: true,
    }));
    const column = this.columns.find(i => i.name == OrderColumn.description);
    column.style = { ...column.style, textOverflow: true };
    const checkboxColumn = this.columns.find((item) => item.name === OrderColumn.checkbox);
    checkboxColumn.tableViewName = 'Checkbox';
    this.setTabIcon('icon-widget-orders');
    this.setTabTitle('Orders');
  }

  handleAccountsConnect(accounts: IAccount[], connectedAccounts: IAccount[]) {
    if (!accounts.length)
      return;

    const hide = this.showLoading();
    this.repository.getItems({ accounts }).subscribe(
      res => {
        hide();
        const { data } = this._processOrders(res);
        this.builder.addItems(data);
      },
      err => {
        hide();
        this.showError(err);
      },
    );
  }

  handleAccountsDisconnect(accounts: IAccount[], connectedAccounts: IAccount[]) {
    this.builder.removeWhere(i => accounts.some(a => a.id === i.accountId.value));
  }

  changeActiveTab(tab: Tab): void {
    this.activeTab = tab;

    switch (tab) {
      case Tab.All:
        this.builder.setParams({ viewItemsFilter: null });
        break;
      case Tab.Filled:
        this.builder.setParams({ viewItemsFilter: i => i.order?.status === OrderStatus.Filled });
        break;
      case Tab.Working:
        this.builder.setParams({
          viewItemsFilter: i => {
            return orderWorkingStatuses.includes(i.order?.status);
          }
        });
        break;
    }
  }

  protected _handleResponse(response: IPaginationResponse<IOrder>, params: any = {}) {
    super._handleResponse(this._processOrders(response), params);
    this.updateCheckboxState(this.contextMenuState);
  }

  protected _transformDataFeedItem(item) {
    return this._processOrder(item);
  }

  private _processOrder = (item) => {
    item.accountId = item.account.id;
    item.instrumentName = item.instrument.symbol;
    return item;
  }

  private _processOrders(response) {
    const data = response.data.map(this._processOrder);
    return { ...response, data };
  }

  protected _deleteItem(item: IOrder) {
    return this.repository.deleteItem(item);
  }

  protected _showSuccessDelete() {
    // handle by realtime
  }

  protected _handleDeleteItems(items) {
    // handle by realtime
  }

  saveState() {
    return { ...this.dataGrid.saveState(), settings: this.settings, componentInstanceId: this.componentInstanceId };
  }

  loadState(state): void {
    if (state && state.columns) {
      this.columns = state.columns;
      const checkboxColumn = state.columns.find(i => i.name === OrderColumn.checkbox);
      checkboxColumn.draw = this._headerCheckboxCell.draw.bind(this._headerCheckboxCell);
    }

    if (state) {
      const { contextMenuState } = state;
      this.contextMenuState = contextMenuState;
      this.componentInstanceId = state.componentInstanceId;
    }
  }

  protected _handleCreateItems(items: IOrder[]) {
    this.builder.handleCreateItems(items.map(this._processOrder));
    this.detectChanges(true);
  }

  protected _handleUpdateItems(items: IOrder[]) {
    const stoppedItems = this.items.filter(item => item.order.status === OrderStatus.Stopped);
    const filteredItems = items.filter(item => !(item.status === OrderStatus.Canceled &&
      stoppedItems.some(stopped => stopped.order.id === item.id)));
    super._handleUpdateItems(filteredItems.map(this._processOrder));
    this.detectChanges(true);
  }

  detectChanges(force = false) {
    const now = Date.now();
    if (!force && (this._updatedAt + this._upadateInterval) > now)
      return;

    this.dataGrid.detectChanges(force);
    this._updatedAt = now;
  }

  applySettings() {
    const { colors, display } = this.settings;
    const buyColor = colors.buyTextColor;
    const sellColor = colors.sellTextColor;
    const heldBuyColor = colors.heldbuyTextColor;
    const heldSellColor = colors.heldsellTextColor;
    const format = display.timestamp === 'Seconds' ? 'HH:mm:ss' : 'HH:mm:ss.SSSS';
    if (format !== this._timeFormatter.dateFormat) {
      this._timeFormatter.dateFormat = format;
      this.builder.allItems.forEach(item => item.applySettings());
    }
    this.columns = this.columns.map(item => {
      item.style.buyColor = buyColor;
      item.style.sellColor = sellColor;
      this._applyColors(item, sellColor, buyColor, '');
      this._applyColors(item, heldSellColor, heldBuyColor, 'held');

      return item;
    });
    this.detectChanges(true);
  }

  private _applyColors(item, sellColor, buyColor, prefix) {
    this._applyColor(item, buyColor, sellColor, prefix);
    this._applyColor(item, buyColor, sellColor, `hovered${ prefix }`);
    this._applyColor(item, buyColor, sellColor, `selected${ prefix }`);
    this._applyColor(item, buyColor, sellColor, `hoveredselected${ prefix }`);
  }

  private _applyColor(item, buyColor, sellColor, prefix = '') {
    item.style[`${ prefix }buyColor`] = buyColor;
    item.style[`${ prefix }sellColor`] = sellColor;
  }

  openOrderForm($event: MouseEvent) {
    this.layout.addComponent({
      component: { name: Components.OrderForm },
      minHeight: 315,
      minWidth: 369,
      height: 315,
      width: 369,
      maximizable: false,
      x: $event.clientX,
      y: $event.clientY,
    });
  }

  handleHeaderCheckboxClick(event: MouseEvent): void {
    if (this._headerCheckboxCell.toggleSelect(event)) {
      this.items.forEach(item => item.updateSelect(this._headerCheckboxCell.checked));
    }
  }

  repriceSelectedOrdersByTickSize(up: boolean): void {
    const requests: Observable<IOrder>[] = [];

    this.items.forEach(item => {
      const order = item.order;
      if (orderWorkingStatuses.includes(order.status) && item.isSelected) {
        requests.push(this._repository.updateItem(this._getRepricedOrderByTickSize(order, up)));
      }
    });

    if (requests.length) {
      const hide = this.showLoading();
      forkJoin(requests)
        .pipe(finalize(hide))
        .subscribe((orders) => {
          this._handleUpdateItems(orders);
        }, error => {
          this.showError(error, 'Failed to update order');
        });
    }
  }

  duplicateSelectedOrder(): void {
    const order = this.selectedOrders[0];

    if (order) {
      order.accountId = order.account.id;
      order.symbol = order.instrument.symbol;
      order.exchange = order.instrument.exchange;
      const orderDto = { ...order, ...getPriceScecsForDuplicate(order) };

      const hide = this.showLoading();
      this._repository.createItem(orderDto)
        .pipe(finalize(hide))
        .subscribe((data) => {
          this._handleCreateItems([data]);
        }, error => {
          this.showError(error, 'Failed to create order');
        });
    }
  }

  handleUpdateColumn(column: Column): void {
    if (column.name === 'checkbox') {
      this.items.forEach(i => i.changeCheckboxHorizontalAlign(column.style.textAlign));
    }
  }

  private _getRepricedOrderByTickSize(order: IOrder, up: boolean): IOrder {
    const updatedOrder = { ...order };
    const tickSize = order.instrument.increment ?? 0.25;

    if ([OrderType.Limit, OrderType.StopLimit].includes(order.type)) {
      updatedOrder.limitPrice = +updatedOrder.price + (up ? tickSize : -tickSize);
    }
    if ([OrderType.StopMarket, OrderType.StopLimit].includes(order.type)) {
      updatedOrder.stopPrice = +updatedOrder.triggerPrice + (up ? tickSize : -tickSize);
    }

    return updatedOrder;
  }

  cancelAllOrders(): void {
    this.cancelOrders(this.orders);
  }

  cancelBuyOrders(): void {
    this.cancelOrders(this.orders.filter(i => i.side === OrderSide.Buy));
  }

  cancelSellOrders(): void {
    this.cancelOrders(this.orders.filter(i => i.side === OrderSide.Sell));
  }

  cancelOrdersByType(orderType: OrderType): void {
    this.cancelOrders(this.orders.filter(i => i.type === orderType));
  }

  cancelSelectedOrders(): void {
    this.cancelOrders(this.selectedOrders);
  }

  cancelOrders(orders: IOrder[]): void {
    const hide = this.showLoading();
    this._repository.deleteMany(orders)
      .pipe(finalize(hide))
      .subscribe({
          next: () => {
            this._handleDeleteItems(orders);
            this._showSuccessDelete();
          },
          error: (error) => this._handleDeleteError(error)
        }
      );
  }

  updateCheckboxState(value) {
    this.items.forEach(item => {
      item.checkbox.showColumnPanel = value.showColumnHeaders;
    });
  }

  protected _subscribeToDataFeed() {
    super._subscribeToDataFeed();

    this.addUnsubscribeFn(this._tradeDataFeed.on((data: TradePrint) => {
      this.items.forEach((item: OrderItem) => {
        if (item.order?.instrument.id === data.instrument.id)
          item.setCurrentPrice(data.price);
      });
    }));
  }

  getOpenSettingsConfig() {
    return {
      name: ordersSettings, width: 550,
      height: 475,
    };
  }

  getCloseSettingsConfig() {
    return { type: Components.OrdersSetting };
  }

  private _getSettingsKey() {
    return `orders-component ${ this.componentInstanceId }`;
  }

  handleGroupChange($event: any) {
    if ($event === this.groupBy)
      return;
    this.groupBy = $event;
    if ($event === GroupByItem.None)
      this.builder.ungroupItems();
    else
      this.groupItems($event);
  }

  groupItems(groupBy) {
    this.builder.groupItems(groupBy, item => {
      if (groupBy === GroupByItem.AccountId) {
        return this.getGroupHeaderItem(item, 'account');
      } else {
        return this.getGroupHeaderItem(item, 'instrumentName');
      }
    });
  }

  getGroupHeaderItem(item, groupBy) {
    const groupedItem = new GroupedOrderItem();
    groupedItem.id = item;
    groupedItem.accountId.updateValue(item);
    return groupedItem;
  }

  save(): void {
    const presets: IOrdersPresets = {
      id: this.loadedPresets?.id,
      name: this.loadedPresets?.name,
      type: Components.Orders
    };

    this.savePresets(presets);
  }
}

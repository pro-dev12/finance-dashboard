import { Component, Injector } from '@angular/core';
import { RealtimeItemsComponent, ViewItemsBuilder, RealtimeGridComponent } from 'base-components';
import { Id, IPaginationResponse } from 'communication';
import { CellClickDataGridHandler, Column } from 'data-grid';
import { ILayoutNode, LayoutNode } from 'layout';
import { LoadingService } from 'lazy-modules';
import { IOrder, IOrderParams, OrdersFeed, OrdersRepository, OrderStatus, OrderType } from 'trading';
import { OrdersToolbarComponent } from './components/toolbar/orders-toolbar.component';
import { OrderItem } from './models/order.item';
import { Components } from 'src/app/modules';

const headers = [
  'averageFillPrice',
  'description',
  'duration',
  'filledQuantity',
  'quantity',
  'side',
  'status',
  'type',
  'exchange',
  'symbol',
  'fcmId',
  'ibId',
  'identifier',
  'close',
];

export interface OrdersComponent extends RealtimeGridComponent<IOrder, IOrderParams> {
}

@Component({
  selector: 'orders-list',
  templateUrl: './orders.component.html',
  styleUrls: ['./orders.component.scss'],
})
@LayoutNode()
export class OrdersComponent extends RealtimeGridComponent<IOrder, IOrderParams> {

  columns: Column[];
  orderTypes = ['All', ...Object.values(OrderType)];
  orderStatus = ['Show All', ...Object.values(OrderStatus)];

  builder = new ViewItemsBuilder();

  private _accountId;

  set accountId(accountId: Id) {
    this._accountId = accountId;
    this.loadData({ ...this.params, accountId });
  }

  get accountId() {
    return this._accountId;
  }

  _isList = false;

  private _toolbarComponent: OrdersToolbarComponent;

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

  handlers = [
    new CellClickDataGridHandler<OrderItem>({
      column: 'close',
      handler: (item) => this.deleteItem(item.order),
    }),
  ];

  constructor(
    protected _repository: OrdersRepository,
    protected _injector: Injector,
    protected _dataFeed: OrdersFeed,
    private _loadingService: LoadingService,
  ) {
    super();
    this.autoLoadData = false;

    this.builder.setParams({
      order: 'desc',
      wrap: (item: IOrder) => new OrderItem(item),
      unwrap: (item: OrderItem) => item.order,
    });

    this.columns = headers.map(header => ({ name: header, visible: true }));

    this.setTabIcon('icon-widget-orders');
    this.setTabTitle('Orders');
  }

  protected _handleResponse(response: IPaginationResponse<IOrder>, params: any = {}) {
    super._handleResponse(response, params);
    this.setTabTitle(`Orders (${response.data.length})`);
  }

  handleAccountChange(accountId: Id): void {
    this.accountId = accountId;
  }

  protected _deleteItem(item: IOrder) {
    return this.repository.deleteItem(item);
  }

  protected _handleDeleteItems(items) {
    // handle by realtime
  }

  saveState() {
    return { columns: this.columns };
  }

  loadState(state): void {
    this._subscribeToConnections();

    if (state && state.columns)
      this.columns = state.columns;
  }

  openOrderForm() {
    this.layout.addComponent(Components.OrderForm);
  }
}

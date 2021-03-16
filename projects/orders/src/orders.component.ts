import { Component, Injector } from '@angular/core';
import { RealtimeGridComponent, ViewItemsBuilder } from 'base-components';
import { Id, IPaginationResponse } from 'communication';
import { CellClickDataGridHandler, CheckboxCell, Column } from 'data-grid';
import { LayoutNode } from 'layout';
import { Components } from 'src/app/modules';
import { IOrder, IOrderParams, OrdersFeed, OrdersRepository, OrderStatus, OrderType } from 'trading';
import { OrdersToolbarComponent } from './components/toolbar/orders-toolbar.component';
import { OrderItem } from './models/order.item';


type HeaderItem = [string, string, IHeaderItemOptions?] | string;

interface IHeaderItemOptions {
  style?: any;
  width?: number;
  drawObject?: { draw(context): boolean }
}

const headerCheckboxCell = new CheckboxCell();

const headers: (HeaderItem | string)[] = [
  ['checkbox', ' ', { width: 30, drawObject: headerCheckboxCell }],
  ['averageFillPrice', 'Average Fill Price'],
  'description',
  'duration',
  ['filledQuantity', 'Filled Quantity'],
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

const allTypes = 'All';
const allStatuses = 'Show All';

@Component({
  selector: 'orders-list',
  templateUrl: './orders.component.html',
  styleUrls: ['./orders.component.scss'],
})
@LayoutNode()
export class OrdersComponent extends RealtimeGridComponent<IOrder, IOrderParams> {

  columns: Column[];
  orderTypes = ['All', ...Object.values(OrderType)];
  orderStatuses = ['Show All', ...Object.values(OrderStatus)];
  orderWorkingStatuses = ['Pending', 'New', 'PartialFilled'];

  orderStatus = allStatuses;
  orderType = allTypes;

  builder = new ViewItemsBuilder<IOrder, OrderItem>();

  get items(): any[] {
    const items = this.builder.items;
    if (!items)
      return [];

    return this.orderStatus === 'Working' ?
      items.filter(item => this.orderWorkingStatuses.filter(status => item.order.status === status).length > 0) :
      items.filter(item => this.orderStatus === allStatuses || item.order.status === this.orderStatus)
  }

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
    new CellClickDataGridHandler<OrderItem>({
      column: 'checkbox',
      handleHeaderClick: true,
      handler: (item, event) => {
        item ? item.toggleSelect(event) : this.handleHeaderCheckboxClick(event);
      },
    })
  ];

  constructor(
    protected _repository: OrdersRepository,
    protected _injector: Injector,
    protected _dataFeed: OrdersFeed,
  ) {
    super();
    this.autoLoadData = false;

    this.builder.setParams({
      order: 'asc',
      wrap: (item: IOrder) => new OrderItem(item),
      unwrap: (item: OrderItem) => item.order,
      addNewItems: 'start',
    });

    this.columns = headers.map((nameOrArr: HeaderItem) => {
      nameOrArr = Array.isArray(nameOrArr) ? nameOrArr : ([nameOrArr, nameOrArr, {}]);
      const [name, title, options] = nameOrArr;

      const column: Column = {
        name,
        title: title.toUpperCase(),
        style: {
          ...options?.style,
          buyColor: 'rgba(72, 149, 245, 1)',
          sellColor: 'rgba(220, 50, 47, 1)',
          textOverflow: true,
          textAlign: 'left',
        },
        visible: true,
        width: options?.width
      };

      if (options?.drawObject) {
        column.draw = (context) => options.drawObject.draw(context)
      }

      return column;
    });
    const column = this.columns.find(i => i.name == 'description');
    column.style = { ...column.style, textOverflow: true };

    this.setTabIcon('icon-widget-orders');
    this.setTabTitle('Orders');
  }

  changeTab(status: string) {
    this.orderStatus = status;
  }

  protected _handleResponse(response: IPaginationResponse<IOrder>, params: any = {}) {
    super._handleResponse(response, params);
    this.updateTitle();
  }

  handleAccountChange(accountId: Id): void {
    this.accountId = accountId;
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
    return { columns: this.columns };
  }

  loadState(state): void {
    this._subscribeToConnections();

    if (state && state.columns)
      this.columns = state.columns;
  }

  openOrderForm() {
    this.layout.addComponent({
      component: { name: Components.OrderForm },
      minHeight: 315,
      minWidth: 369,
      height: 315,
      width: 369,
      maximizable: false,
    });
  }

  updateTitle() {
    setTimeout(() => this.setTabTitle(`Orders (${this.items.length})`));
  }

  handleHeaderCheckboxClick(event: MouseEvent): void {
    if (headerCheckboxCell.toggleSelect(event)) {
      this.items.forEach(item => item.updateSelect(headerCheckboxCell.checked));
    }
  }
}

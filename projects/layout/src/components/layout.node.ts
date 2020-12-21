import { ComponentRef } from '@angular/core';
import { ILinkNode, LinkDataObserver } from '../observers';
import { LayoutNodeEvent } from './layout-node.event';
import { Layout } from './layout/layouts/layout';

declare const $: any;

// To remove
export interface IContainer {
  maximized: object | boolean;
  minimized: boolean;
  setTitle(title: string);
  minimize();
  maximize();
  close();
}

export interface IStateProvider<T = any> {
  saveState?(): T;
  loadState?(state: T);
}

export interface ILayoutNode {
  layout?: Layout;

  setTabIcon?(icon: string);
  getTabIcon?(): string;
  getTabTitle?(): string;
  setTabTitle?(value: string);
  handleNodeEvent(name: LayoutNodeEvent, event);
  broadcastLinkData?(data: any);
  addLinkObserver?(observer: ILinkNode);
  broadcastData?(link: string | number, data: any);
  maximize?();
  minimize?();
  close?();
  isMaximized?();
}

// tslint:disable-next-line: no-empty-interface
interface _LayoutNode extends ILayoutNode, IStateProvider, ILinkNode<any> {

}

const linkDataObserver = new LinkDataObserver();

// tslint:disable-next-line: class-name
abstract class _LayoutNode implements IStateProvider<any>, ILayoutNode {

  private componentRef: ComponentRef<typeof _LayoutNode>;

  private _tabTitle: string;

  private _tabIcon: string;

  layoutContainer: IContainer;
  layout: Layout;

  link: number;

  __onRemove: any[];

  onRemove(fn: () => void) {
    if (!Array.isArray(this.__onRemove))
      this.__onRemove = [];
    this.__onRemove.push(fn);
  }

  addLinkObserver(observer: ILinkNode) {
    linkDataObserver.subscribe(observer);

    this.onRemove(() => linkDataObserver.unsubscribe(observer));
  }

  setLayoutContainer(value) {
    this.layoutContainer = value;
    this._subscribeContainerLayoutEvents(value);
    this._initContainerLayoutEvents(value);
    this.addLinkObserver(this);
  }

  broadcastLinkData(data: any) {
    this.broadcastData(this.link, data);
  }

  broadcastData(link: string | number, data: any) {
    linkDataObserver.emitLinkData({
      creator: this,
      data,
      link,
    });
  }

  handleDestroy() {
    console.log('handleDestroy', this.constructor.name);
    if (this.componentRef)
      this.componentRef.destroy();

    if (Array.isArray(this.__onRemove)) {
      for (const fn of this.__onRemove) {
        try {
          fn();
        } catch (e) {
          console.error('On remove error', e);
        }
      }
    }
  }

  handleHide() {
    // if (this.componentRef)
    //   this.componentRef.changeDetectorRef.detach();
  }

  handleShow() {
    // if (this.componentRef)
    //   this.componentRef.changeDetectorRef.reattach();
  }

  private _handleLayoutNodeEvent(name: LayoutNodeEvent, event) {
    // console.log(name, event, this._layoutContainer);
    const $componentContainer = $('.wm-container > section');
    switch (name) {
      case LayoutNodeEvent.Destroy:
        this.handleDestroy();
        break;
      case LayoutNodeEvent.Hide:
        this.handleHide();
        break;
      case LayoutNodeEvent.Show:
        this.handleShow();
        break;
      case LayoutNodeEvent.MoveStart:
        $componentContainer.addClass('pointer-events-none');
        break;
      case LayoutNodeEvent.MoveEnd:
        $componentContainer.removeClass('pointer-events-none');
        break;
      case LayoutNodeEvent.ExtendState:
        // this._layoutContainer.setState({
        //   link: this.link || 0,
        //   component: this.saveState ? this.saveState() : {},
        // });
        break;
    }

    if (this.handleNodeEvent)
      this.handleNodeEvent(name, event);
  }

  private _subscribeContainerLayoutEvents(container) {
    container.on('__all', (name, event) => this._handleLayoutNodeEvent(name, event));
  }

  private _initContainerLayoutEvents(container) {
    if (this._tabTitle)
      container.setTitle(this._tabTitle);
  }

  setTabTitle(value: string) {
    if (this._tabTitle === value)
      return;

    this._tabTitle = value;
    if (this.layoutContainer)
      this.layoutContainer.setTitle(value);
  }

  setTabIcon(icon: string) {
    this._tabIcon = icon;
  }

  getTabIcon(): string {
    return this._tabIcon ?? '';
  }

  getTabTitle() {
    return this._tabTitle ?? '';
  }

  isMaximized() {
    return this.layoutContainer.maximized;
  }

  close() {
    this.layoutContainer.close();
  }

  minimize() {
    this.layoutContainer.minimize();
  }

  maximize() {
    this.layoutContainer.maximize();
  }

  _removeItself() {
    try {
      if (this.layoutContainer)
        this.layoutContainer.close();
    } catch (e) {
      console.error(e);
    }
  }
}

export function LayoutNode(): <T extends { new(...args: any) }>(constructor: T) => void {
  return (derivedCtor: any) => {
    Object.getOwnPropertyNames(_LayoutNode.prototype)
      .forEach(name => {
        if (name !== 'constructor') {
          derivedCtor.prototype[name] = _LayoutNode.prototype[name];
        }
      });
  };
}

import { Component } from '@angular/core';
import { EVENTS, IWindow, WindowManagerService } from 'window-manager';
import { Components } from '../../../modules';

export type WindowTuple = [string, Set<IWindow>];

@Component({
  selector: 'app-frames-manager',
  templateUrl: './frames-manager.component.html',
  styleUrls: ['./frames-manager.component.scss']
})
export class FramesManagerComponent {
  public highlightedWindow: IWindow;
  public windowTuples: WindowTuple[] = [
    [Components.Chart, new Set()],
    [Components.Watchlist, new Set()],
    [Components.Positions, new Set()],
    [Components.Orders, new Set()],
    [Components.Dom, new Set()],
    [Components.OrderForm, new Set()]
  ];

  public iconsMap = {
    [Components.Chart]: 'icon-widget-chart',
    [Components.Watchlist]: 'icon-widget-watchlist',
    [Components.Orders]: 'icon-widget-orders',
    [Components.Positions]: 'icon-widget-positions',
    [Components.Dom]: 'icon-widget-dom',
    [Components.OrderForm]: 'icon-widget-create-orders'

  };

  get windowAreaTopPosition(): number {
    return this.highlightedWindow.y + this.highlightedWindow.globalOffset?.top;
  }

  get windowAreaLeftPosition(): number {
    return this.highlightedWindow.x + this.highlightedWindow.globalOffset?.left;
  }

  constructor(private windowManagerService: WindowManagerService) {
    this.windowManagerService.windows.subscribe(windows => {
      this._setWindowTuples(windows);
    });
  }

  public handleClick(window: IWindow): void {
    window.minimize();
    if (!window.minimized) {
      window.focus();
    }
    this.hideWindowArea();
  }

  private _setWindowTuples(windows: IWindow[]): void {
    this.windowTuples.forEach(windowTuple => windowTuple[1].clear());

    for (const window of windows) {
      const windowTuple = this.windowTuples.find(([type]) => type === window.type);

      if (windowTuple) {
        windowTuple[1].add(window);
      }
    }
  }

  getComponentStateName(window: IWindow, componentName: string): string {
    if (window.component?.getNavbarTitle) {
      return window.component.getNavbarTitle();
    }
    return this.getTitle(componentName);
  }

  getTitle(name: string): string {
    const componentTitle = componentTitles[name];
    if (componentTitle)
      return componentTitle;
    const title = name.replace(/-/g, ' ');
    return title[0].toUpperCase() + title.slice(1);
  }

  highlightWindowArea(window: IWindow): void {
    if (window.minimized)
      this.highlightedWindow = window;
  }

  hideWindowArea(): void {
    this.highlightedWindow = null;
  }

  closeWindow(window: IWindow): void {
    window.close();
    this.hideWindowArea();
  }
}

const componentTitles = {
  [Components.OrderForm]: 'Order Ticket'
};

import { AfterViewInit, Component } from '@angular/core';
import { EVENTS, IWindow, WindowManagerService } from 'window-manager';
import { Components } from '../../../modules';

export type WindowTuple = [string, Set<IWindow>];

@Component({
  selector: 'app-frames-manager',
  templateUrl: './frames-manager.component.html',
  styleUrls: ['./frames-manager.component.scss']
})
export class FramesManagerComponent implements AfterViewInit {

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

  constructor(private windowManagerService: WindowManagerService) {
    this.windowManagerService.windows.subscribe(windows => {
      this.sortWindows(windows);
    });
  }

  ngAfterViewInit(): void {
  }

  public handleClick(window: IWindow): void {
    window.minimize();
  }

  private sortWindows(windows: IWindow[]): void {
    for (const window of windows) {
      const windowTuple = this.windowTuples.find(([type]) => type === window.type);

      if (windowTuple) {
        windowTuple[1].add(window);
        window.on(EVENTS.CLOSE, () => windowTuple[1].delete(window));
      }
    }
  }

  getTitle(name: string) {
    const componentTitle = componentTitles[name];
    if (componentTitle)
      return componentTitle;
    const title = name.replace(/-/g, ' ');
    return title[0].toUpperCase() + title.slice(1);
  }
}

const componentTitles = {
  [Components.OrderForm]: 'Order Ticket'
};

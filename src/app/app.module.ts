import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { RouterModule } from '@angular/router';
import { ContextMenuModule } from 'context-menu';
import { FakeCommunicationModule } from 'fake-communication';
import { NZ_I18N, en_US, NzI18nService } from 'ng-zorro-antd/i18n';
import { LayoutModule } from 'layout';
import { LoadingModule } from 'lazy-modules';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NotifierModule } from 'notifier';
import { ThemesHandler } from 'themes';
import { AppComponent, DashboardComponent, DragDrawerComponent, NavbarComponent } from './components';
import { NzDropDownModule } from 'ng-zorro-antd/dropdown';
import { Modules, modulesStore } from './modules';


@NgModule({
  declarations: [
    NavbarComponent,
    DashboardComponent,
    DragDrawerComponent,
    AppComponent,
  ],
  imports: [
    BrowserModule.withServerTransition({appId: 'serverApp'}),
    NzModalModule,
    BrowserAnimationsModule,
    NotifierModule,
    ContextMenuModule,
    LayoutModule.forRoot(),
    LoadingModule.forRoot([
      {
        path: Modules.Chart,
        loadChildren: () => import('./modules/chart/chart.module').then(i => i.ChartModule)
      },
      {
        path: Modules.Watchlist,
        loadChildren: () => import('watchlist').then(i => i.WatchlistModule)
      },
      {
        path: Modules.Positions,
        loadChildren: () => import('./modules/positions/positions.module').then(i => i.PositionsModule)
      },
      {
        path: Modules.Orders,
        loadChildren: () => import('./modules/orders/orders.module').then(i => i.OrdersModule)
      },
      {
        path: Modules.OrderForm,
        loadChildren: () => import('./modules/order-form/order-form.module').then(i => i.OrderFormModule)
      },
      {
        path: Modules.Settings,
        loadChildren: () => import('./modules/settings/settings.module').then(i => i.SettingsModule)
      },
      {
        path: Modules.Scripting,
        loadChildren: () => import('scripting').then(i => i.ScriptingModule)
      }
    ], modulesStore),
    FakeCommunicationModule.forRoot(),
    RouterModule.forRoot([
      {
        path: '',
        component: DashboardComponent,
      },
      {
        path: '**',
        component: DashboardComponent,
      },
    ]),
    NzDropDownModule,
  ],
  providers: [
    ThemesHandler,
    { provide: NZ_I18N, useValue: en_US },
  ],
  bootstrap: [AppComponent]
})
export class AppModule {
  constructor(private i18n: NzI18nService) {
  }
  switchLanguage(){
    this.i18n.setLocale(en_US);
  }
}

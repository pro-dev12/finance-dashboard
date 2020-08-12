import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NavbarComponent, DashboardComponent, AppComponent } from './components';
import { RouterModule } from '@angular/router';
import { LayoutModule } from 'layout';
import { LoadingModule } from 'lazy-modules';
import { FakeCommunicationModule } from 'fake-communication';
import {DragDrawerComponent} from './components/dashboard/drag-drawer/drag-drawer.component';

@NgModule({
  declarations: [
    NavbarComponent,
    DashboardComponent,
    DragDrawerComponent,
    AppComponent,
  ],
  imports: [
    BrowserModule.withServerTransition({ appId: 'serverApp' }),
    NzModalModule,
    BrowserAnimationsModule,
    LayoutModule.forRoot(),
    LoadingModule.forRoot(),
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
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule {
}

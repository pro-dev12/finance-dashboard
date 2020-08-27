import { ModuleWithProviders, NgModule, NgZone } from '@angular/core';
import { AccountRepository, OrdersRepository, PositionsRepository} from 'communication';
import { Datafeed, InstrumentsRepository } from '../communication';
import { FakeAccountRepository, FakeDatafeed, FakeInstrumentsRepository, FakeOrdersRepository, FakePositionsRepository} from './trading';

@NgModule({})
export class FakeCommunicationModule {
    static forRoot(): ModuleWithProviders<FakeCommunicationModule> {
        return {
            ngModule: FakeCommunicationModule,
            providers: [
                {
                    provide: InstrumentsRepository,
                    useClass: FakeInstrumentsRepository,
                },
                {
                    provide: Datafeed,
                    useClass: FakeDatafeed,
                    deps: [NgZone],
                },
              {
                provide: PositionsRepository,
                useClass: FakePositionsRepository
              },
              {
                provide: OrdersRepository,
                useClass: FakeOrdersRepository
              },
              {
                provide: AccountRepository,
                useClass: FakeAccountRepository
              }
            ]
        };
    }
}

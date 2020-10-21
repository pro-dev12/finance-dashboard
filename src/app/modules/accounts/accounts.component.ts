import { Component, OnDestroy } from '@angular/core';
import { UntilDestroy } from '@ngneat/until-destroy';
import { ItemsComponent } from 'core';
import { NzModalRef, NzModalService } from 'ng-zorro-antd/modal';
import { AccountRepository, IAccount } from '../communication';
import { AccountConnectComponent } from './account-connect/account-connect.component';

@UntilDestroy()
@Component({
  selector: 'account-list',
  templateUrl: './accounts.component.html',
  styleUrls: ['./accounts.component.scss'],
})
export class AccountsComponent extends ItemsComponent<IAccount> implements OnDestroy {

  _accountConnectModal: NzModalRef = null;

  items: IAccount[] = [];
  accounts = [];
  status = 'Open';

  constructor(
    public _repository: AccountRepository,
    private modal: NzModalRef,
    private modalService: NzModalService,
  ) {
    super();
    this.config.autoLoadData = {onInit: true};
    this.addAccount(); // Cut functionality
  }

  ngOnDestroy(): void {
    this.modal.destroy();
  }

  addAccount() {
    this.modalService.create({
      nzTitle: null,
      nzContent: AccountConnectComponent,
      nzCloseIcon: null,
      nzFooter: null,
      nzWidth: 720,
    }).afterClose.subscribe((newAccount: IAccount) => {
      if (newAccount) this.items.push(newAccount);
      this.modal.close(); // Cut functionality
    });
  }
}

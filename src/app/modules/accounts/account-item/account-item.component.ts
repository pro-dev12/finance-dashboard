import {Component, Input} from '@angular/core';
import {IAccount} from 'communication';

@Component({
  selector: 'account-item',
  templateUrl: './account-item.component.html',
  styleUrls: ['./account-item.component.scss']
})
export class AccountItemComponent {
  @Input() account: IAccount;
}

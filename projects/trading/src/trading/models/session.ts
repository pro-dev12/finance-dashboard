import { IBaseItem, Id } from 'communication';

export interface ISessionWorkingTime {
  startDay: number;
  startTime: number;
  endDay: number;
  endTime: number;
}

export interface ISession extends IBaseItem {
  name: string;
  exchange: string;
  timezoneId: Id;
  workingTime: ISessionWorkingTime[];
}

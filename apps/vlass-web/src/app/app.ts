import { Component } from '@angular/core';

@Component({
  selector: 'app-root',
  templateUrl: './app.html',
  styleUrls: ['./app.scss'],
  standalone: false, // eslint-disable-line @angular-eslint/prefer-standalone
})
export class App {
  protected title = 'vlass-web';
}

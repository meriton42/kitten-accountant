import { Component } from '@angular/core';
import { ResourceNames, Res, state } from "app/game-state";

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent {
  title = 'app works!';

  resourceNames = ResourceNames;

  price = state.price;

  buildings = state.buildings;

  constructor() {}
}

import { Component, OnInit } from '@angular/core';
import { resourceNames, Res, state, Building, saveGameState, resetGameState } from "app/game-state";
import { economyReport, Action } from "app/economy";

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit {
  title = 'app works!';

  resourceNames = resourceNames;
  level = state.level;

  price: {[R in Res]: number};
  actions: Action[];

  ngOnInit() {
    this.update();
  }

  update() {
    saveGameState();
    const eco = economyReport();
    this.price = eco.price;
    this.actions = eco.actions;
  }

  forget() {
    resetGameState();
  }

  build(name: Building, count: number) {
    state.level[name] += count;
    this.update();
    return false; // suppress context menu
  }
}

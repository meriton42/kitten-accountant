import { Component, OnInit } from '@angular/core';
import { resourceNames, Res, state, Building, saveGameState, resetGameState, jobNames, Job } from "app/game-state";
import { economyReport, Action } from "app/economy";

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit {
  title = 'app works!';

  resourceNames = resourceNames;
  jobNames = jobNames;

  level = state.level;
  upgrades = state.upgrades;
  workers = state.workers;

  price: {[R in Res]: number};
  production: {[R in Res]: number};
  actions: Action[];

  ngOnInit() {
    this.update();
  }

  update() {
    saveGameState();
    const eco = economyReport();
    this.price = eco.price;
    this.production = eco.production;
    this.actions = eco.actions;
  }

  forget() {
    resetGameState();
  }

  addWorker(job: Job, count: number) {
    state.workers[job] += count;
    state.workers.farmer -= count;
    this.update();
    return false; // suppress context menu
  }

  apply(action: Action) {
    action.applyTo(state);
    this.update();
  }

  undo(action: Action) {
    action.undo();
    this.update();
    return false; // suppress context menu
  } 

  set showResearchedUpgrades(newValue: boolean) {
    state.showResearchedUpgrades = newValue;
    this.update();
  }

  get showResearchedUpgrades() {
    return state.showResearchedUpgrades;
  }
}

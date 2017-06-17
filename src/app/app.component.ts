import { Component, OnInit } from '@angular/core';
import { resourceNames, Res, state, Building, saveGameState, resetGameState, jobNames, Job, convertedResourceNames, ConvertedRes } from "app/game-state";
import { economyReport, Action, Investment, CostBenefitAnalysis, Conversion } from "app/economy";

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
})
export class AppComponent implements OnInit {
  title = 'app works!';

  resourceNames = resourceNames;
  jobNames = jobNames;

  workers = state.workers;
  luxury = state.luxury;
  level = state.level;
  upgrades = state.upgrades;

  price: {[R in Res]: number};
  production: {[R in Res]: number};
  actions: Action[];
  storageActions: Action[];
  furReport: CostBenefitAnalysis;
  conversions: {[R in ConvertedRes]?: Conversion};

  ngOnInit() {
    this.update();
  }

  update() {
    saveGameState();
    const eco = economyReport();
    this.price = eco.price;
    this.production = eco.production;
    this.actions = eco.actions;
    this.storageActions = eco.storageActions;
    this.furReport = eco.furReport;
    this.conversions = {};
    for (const conv of eco.conversions) {
      this.conversions[conv.product] = conv;
    }
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
    action.undo(state);
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

  set karma(newValue: number) {
    state.karma = newValue;
    this.update();
  }

  get karma() {
    return state.karma;
  }

  increaseResource(res: Res, count: number) {
    if (res == "iron") {
      state.ironMarkup = Math.max(0, state.ironMarkup + count);
      this.update();
      return false;
    }
    if (res == "coal") {
      state.coalPrice = state.coalPrice * Math.pow(1.15, count);
      this.update();
      return false;
    }

    if (convertedResourceNames.includes(<any>res)) {
      state.conversionProportion[res] = Math.max(0, state.conversionProportion[res] + 0.1 * count);
      this.update();
      return false;
    }
  }

  toggleLuxury(res: "fur", event) {
    state.luxury[res] = !state.luxury[res];
    this.update();
    event.stopPropagation();
    return false;
  }
}

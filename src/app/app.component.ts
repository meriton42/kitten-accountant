import { Component, OnInit } from '@angular/core';
import { resourceNames, Res, state, Building, saveGameState, resetGameState, jobNames, Job, convertedResourceNames, ConvertedRes, userPricedResourceNames } from "app/game-state";
import { economyReport, Action, Investment, CostBenefitAnalysis, Conversion, solarRevolutionProductionBonus } from "app/economy";
import { CbaTooltipService } from 'app/cba-tooltip.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  providers: [
    CbaTooltipService
  ]
})
export class AppComponent implements OnInit {
  title = 'app works!';

  state = state;

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
  metaphysicActions: Action[];
  furReport: CostBenefitAnalysis;
  conversions: {[R in ConvertedRes]?: Conversion};

  shipsAsString: string;

  constructor(public cbaTooltip: CbaTooltipService) {}

  ngOnInit() {
    this.update();
  }

  saveGameState() {
    saveGameState();
  }

  update() {
    saveGameState();
    const eco = economyReport();
    this.price = eco.price;
    this.production = eco.production;
    this.actions = eco.actions;
    this.storageActions = eco.storageActions;
    this.metaphysicActions = eco.metaphysicActions;
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

  apply(action: Action, click: MouseEvent) {
    const times = click.ctrlKey ? 10 : 1;
    for (let i = 0; i < times; i++) {
      action.applyTo(state);
    }
    this.update();
  }

  undo(action: Action, click: MouseEvent) {
    const times = click.ctrlKey ? 10 : 1;
    for (let i = 0; i < times; i++) {
      action.undo(state);
    }
    this.update();
    return false; // suppress context menu
  }

  increasePrice(res: Res, count: number) {
    if (userPricedResourceNames.includes(<any>res)) {
      state.priceMarkup[res] *= Math.pow(1.15, count);
      if (state.priceMarkup.faith > 1) {
        state.priceMarkup.faith = 1;
      }
      if (state.priceMarkup.coal > 1) {
        state.priceMarkup.coal = 1;
      }
      if (state.priceMarkup.uranium > 1) {
        state.priceMarkup.uranium = 1;
      }
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

  get faithBonus() {
    return solarRevolutionProductionBonus(state);
  }
}

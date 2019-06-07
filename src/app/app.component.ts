import { Component, OnInit, EventEmitter } from '@angular/core';
import { resourceNames, Res, state, saveGameState, resetGameState, jobNames, Job, convertedResourceNames, ConvertedRes, userPricedResourceNames } from "./game-state";
import { economyReport, Action, CostBenefitAnalysis, Conversion, solarRevolutionProductionBonus, ScienceInfo } from "./economy";
import { CbaTooltipService } from './cba-tooltip.service';
import { HelpService } from './help.service';
import { debounceTime } from 'rxjs/operators';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  providers: [
    CbaTooltipService,
    HelpService,
  ]
})
export class AppComponent implements OnInit {
  showGame = false;
  showHelp = false;

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
  sciences: ScienceInfo[];
  metaphysicActions: Action[];
  furReport: CostBenefitAnalysis;
  conversions: {[R in ConvertedRes]?: Conversion};

  shipsAsString: string;

  updateRequest = new EventEmitter();

  constructor(public cbaTooltip: CbaTooltipService, public helpService: HelpService) {
    this.updateRequest.pipe(debounceTime(200)).subscribe(() => {
      // since the Viewcontainer moves subviews by temporarily removing them, moved elements may lose keyboard focus
      // we therefore delay the update until the user has (hopefullly) finished typing, and restore the focus manually afterwards
      // (we realize this is hacky, but short of patching angular itself we didn't find a better solution)      
      const previouslyFocused = document.activeElement as HTMLElement;
      this.update();
      setTimeout(() => { // after the DOM update
        previouslyFocused.focus(); 
      })
    })
  }

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
    this.sciences = eco.sciences;
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
        alert("Using priests would be more efficient");
        state.priceMarkup.faith = 1;
      }
      if (state.priceMarkup.coal > 1) {
        alert("using geologists would be more efficient");
        state.priceMarkup.coal = 1;
      }
      if (state.priceMarkup.uranium > 1) {
        alert("trading with dragons would be more efficient");
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

  numeric(x: any) {
    return typeof x === 'number';
  }

  sameName(index: number, action: Action) {
    return action.name;
  }
}

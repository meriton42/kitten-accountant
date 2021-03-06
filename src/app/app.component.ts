import { Component, OnInit, EventEmitter } from '@angular/core';
import { resourceNames, Res, state, saveGameState, jobNames, Job, ConvertedRes, userPricedResourceNames } from "./game-state";
import { economyReport, Action, CostBenefitAnalysis, Conversion, solarRevolutionProductionBonus, ScienceInfo, praiseBonus, setPraiseBonus, faithReset, transcend, reset } from "./economy";
import { CbaTooltipService } from './cba-tooltip.service';
import { HelpService } from './help.service';
import { debounceTime } from 'rxjs/operators';
import { apply } from './game-state-changer';

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

  reset() {
    reset(state);
  }

  addWorker(job: Job, count: number) {
    state.workers[job] += count;
    state.workers.farmer -= count;
    this.update();
    return false; // suppress context menu
  }

  apply(action: Action | ScienceInfo, click: MouseEvent) {
    let times = click.button == 0 ? 1 : -1;
    if (click.ctrlKey) {
      times *= 10;
    }
    apply(state, action.effect(times));
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

  get praiseBonus() {
    return Math.round(100 * praiseBonus(state));
  }

  set praiseBonus(praiseBonus: number) {
    setPraiseBonus(praiseBonus / 100, state);
    this.update(); // recalculate PraiseTheSun
  }

  faithReset(times: number) {
    faithReset(state, times < 0);
    this.update();
    return false;
  }

  transcend(times: number) {
    transcend(state, times);
    this.update();
    return false;
  }

  numeric(x: any) {
    return typeof x === 'number';
  }

  sameName(index: number, action: Action) {
    return action.name;
  }
}

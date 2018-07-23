import { Component, OnInit, Input } from '@angular/core';

@Component({
	selector: 'panel',
	template: `
		<h2 style="text-align: center">{{heading}}</h2>
		<ng-content></ng-content>
	`
})
export class PanelComponent {

	@Input() heading: string;

}
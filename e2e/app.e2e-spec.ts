import { KittenAccountantPage } from './app.po';

describe('kitten-accountant App', () => {
  let page: KittenAccountantPage;

  beforeEach(() => {
    page = new KittenAccountantPage();
  });

  it('should display message saying app works', () => {
    page.navigateTo();
    expect(page.getParagraphText()).toEqual('app works!');
  });
});

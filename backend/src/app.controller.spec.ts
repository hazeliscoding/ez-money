import { AppController } from './app.controller';

describe('AppController', () => {
  const controller = new AppController();

  it('reports health', () => {
    expect(controller.health()).toEqual({ status: 'ok' });
  });

  it('lists categories', () => {
    expect(controller.categories()).toContain('Groceries');
  });
});

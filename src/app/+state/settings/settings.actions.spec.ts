import * as fromLoadSettings from './settings.actions';

describe('loadLoadSettingss', () => {
  it('should return an action', () => {
    expect(fromLoadSettings.loadSettings().type).toBe(
      '[LoadSettings] Load LoadSettingss'
    );
  });
});

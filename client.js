/**
 * dsh-tinyfish-websearch — browser half.
 *
 * A classic script served at /plugins/dsh-tinyfish-websearch/client.js and
 * executed by the client module system (the package.json `dsh.client`
 * declaration makes client-modules pick the package up automatically). It
 * registers a factory through window.__ModuleLoader__.load; the factory's
 * exports become the cordis loader entry, so `apply(ctx)` runs as a
 * browser-side plugin.
 *
 * Contribution: one `settings.section` entry — 「TinyFish 搜索」— with a form
 * that writes the TinyFish API key through the credentials RPC
 * (`api.credentials.set`), which lands in `$DSH_HOME/.credentials.yaml`.
 * The host half resolves the key per search through the credentials seam,
 * so a key saved here takes effect on the next search without a restart.
 */
var module = { exports: {} };
var exports = module.exports;
window.__ModuleLoader__.load({
  id: 'dsh-tinyfish-websearch',
  factory: function (require) {
    'use strict';
    var React = require('react');

    var NS = 'settings.tinyfish';
    var inject = ['slots', 'locale', 'connection'];
    var REF = 'TINYFISH_API_KEY';

    var zh = {
      nav: 'TinyFish 搜索',
      title: 'TinyFish 搜索设置',
      loading: '加载中…',
      notConfigured: '尚未配置 API Key。',
      configuredFrom: '已配置（来源：{source}）。',
      readOnly: '当前 Key 由只读层提供（环境变量 / .env），界面不可修改；请改环境变量后重启。',
      keyLabel: 'API Key',
      keyPlaceholder: 'TinyFish API Key',
      save: '保存',
      clear: '清除',
      saved: '已保存，下次搜索立即生效。',
      cleared: '已清除。',
      retry: '重试',
      hint: 'web_search 工具当前使用 TinyFish（searchProvider: tinyfish）。结果数等参数在 ~/.dsh/profiles/web/cordis.patch.yml 的 tinyfish-websearch 行配置。',
    };
    var en = {
      nav: 'TinyFish Search',
      title: 'TinyFish search settings',
      loading: 'Loading…',
      notConfigured: 'No API key configured yet.',
      configuredFrom: 'Configured (source: {source}).',
      readOnly: 'The key comes from a read-only layer (environment / .env); edit it there and restart.',
      keyLabel: 'API Key',
      keyPlaceholder: 'TinyFish API Key',
      save: 'Save',
      clear: 'Clear',
      saved: 'Saved; the next search picks it up immediately.',
      cleared: 'Cleared.',
      retry: 'Retry',
      hint: 'The web_search tool currently uses TinyFish (searchProvider: tinyfish). Result counts etc. live in the tinyfish-websearch row of ~/.dsh/profiles/web/cordis.patch.yml.',
    };

    var styles = {
      wrap: { maxWidth: 560, display: 'flex', flexDirection: 'column', gap: 14, padding: '8px 0' },
      title: { fontSize: 16, fontWeight: 600, margin: 0 },
      hint: { color: 'var(--dsw-alias-label-tertiary)', fontSize: 13, lineHeight: 1.6, margin: 0 },
      error: { color: 'var(--dsw-alias-state-error-primary)', fontSize: 13, lineHeight: 1.6, margin: 0 },
      ok: { color: 'var(--dsw-alias-state-success-primary, #22c55e)', fontSize: 13, lineHeight: 1.6, margin: 0 },
      row: { display: 'flex', alignItems: 'center', gap: 8 },
      input: {
        flex: 1, minWidth: 0, boxSizing: 'border-box', height: 32,
        padding: '0 10px', font: 'inherit', fontSize: 14, lineHeight: 22,
        color: 'var(--dsw-alias-label-primary)',
        background: 'var(--dsw-alias-bg-layer-1)', border: '1px solid var(--dsw-alias-border-l2)',
        borderRadius: 8,
      },
      button: {
        border: '1px solid var(--dsw-alias-border-l2)', color: 'var(--dsw-alias-label-primary)',
        font: 'inherit', fontSize: 13, cursor: 'pointer', background: 'transparent', borderRadius: 6, padding: '5px 12px',
      },
    };

    /** One settings entry rendering the key form over the credentials RPC. */
    function SettingsPanel(props) {
      var api = props.api;
      var t = props.t;
      var viewPair = React.useState(null);
      var view = viewPair[0];
      var setView = viewPair[1];
      var statusPair = React.useState('loading');
      var status = statusPair[0];
      var setStatus = statusPair[1];
      var errorPair = React.useState(null);
      var error = errorPair[0];
      var setError = errorPair[1];
      var valuePair = React.useState('');
      var value = valuePair[0];
      var setValue = valuePair[1];
      var busyPair = React.useState(false);
      var busy = busyPair[0];
      var setBusy = busyPair[1];
      var noticePair = React.useState(null);
      var notice = noticePair[0];
      var setNotice = noticePair[1];

      var refresh = React.useCallback(function () {
        api.credentials.describe({ refs: [REF] }).then(function (res) {
          if (res.result.ok) {
            setView(res.result.value.credentials[REF]);
            setStatus('ready');
            setError(null);
          } else {
            setStatus('failure');
            setError(res.result.error.message);
          }
        }).catch(function (e) {
          setStatus('failure');
          setError(String((e && e.message) || e));
        });
      }, [api, setView, setStatus, setError]);

      React.useEffect(function () { refresh(); }, [refresh]);

      var save = function () {
        if (value.length === 0 || busy) return;
        setBusy(true);
        api.credentials.set({ ref: REF, value: value }).then(function (res) {
          if (res.result.ok) {
            setNotice({ kind: 'ok', text: t('saved') });
            setValue('');
            refresh();
          } else {
            setNotice({ kind: 'err', text: res.result.error.message });
          }
        }).catch(function (e) {
          setNotice({ kind: 'err', text: String((e && e.message) || e) });
        }).finally(function () { setBusy(false); });
      };

      var clear = function () {
        if (busy) return;
        setBusy(true);
        api.credentials.unset({ ref: REF }).then(function (res) {
          if (res.result.ok) {
            setNotice({ kind: 'ok', text: t('cleared') });
            refresh();
          } else {
            setNotice({ kind: 'err', text: res.result.error.message });
          }
        }).catch(function (e) {
          setNotice({ kind: 'err', text: String((e && e.message) || e) });
        }).finally(function () { setBusy(false); });
      };

      if (status === 'loading') {
        return React.createElement('div', { style: styles.wrap },
          React.createElement('p', { style: styles.hint }, t('loading')));
      }
      if (status === 'failure') {
        return React.createElement('div', { style: styles.wrap },
          React.createElement('p', { style: styles.error }, error),
          React.createElement('button', { style: styles.button, onClick: refresh }, t('retry')));
      }

      var configured = !!(view && view.configured);
      var writable = !view || view.writable !== false;
      var stateLine = configured
        ? t('configuredFrom').replace('{source}', view.source || '?')
        : t('notConfigured');

      return React.createElement('div', { style: styles.wrap },
        React.createElement('h2', { style: styles.title }, t('title')),
        React.createElement('p', { style: styles.hint }, stateLine),
        !writable
          ? React.createElement('p', { style: styles.error }, t('readOnly'))
          : React.createElement('div', { style: styles.row },
              React.createElement('input', {
                type: 'password',
                placeholder: t('keyPlaceholder'),
                value: value,
                onChange: function (e) { setValue(e.target.value); },
                style: styles.input,
                autoComplete: 'off',
              }),
              React.createElement('button', {
                style: styles.button,
                onClick: save,
                disabled: busy || value.length === 0,
              }, t('save')),
              configured
                ? React.createElement('button', { style: styles.button, onClick: clear, disabled: busy }, t('clear'))
                : null,
            ),
        notice
          ? React.createElement('p', { style: notice.kind === 'ok' ? styles.ok : styles.error }, notice.text)
          : null,
        React.createElement('p', { style: styles.hint }, t('hint')));
    }

    /**
     * Browser plugin body: register the dictionaries and the settings entry.
     * @param ctx - the browser-side cordis context.
     */
    function apply(ctx) {
      ctx.effect(function () { ctx.locale.register(NS, { zh: zh, en: en }); }, 'tinyfish-websearch: dictionaries');
      var t = ctx.locale.bind(NS);
      var injected = function () {
        return {
          api: ctx.get('connection').api,
          t: t,
        };
      };
      ctx.slots.inject('settings.section', function () {
        return ctx.slots.register({
          name: 'settings.section',
          id: 'tinyfish',
          order: 50,
          label: function () { return t('nav'); },
          locale: NS,
          inject: injected,
        }, SettingsPanel);
      });
    }

    exports.NS = NS;
    exports.apply = apply;
    exports.inject = inject;
    return module.exports;
  },
});

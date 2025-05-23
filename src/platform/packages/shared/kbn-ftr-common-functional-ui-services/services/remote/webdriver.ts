/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import { resolve } from 'path';
import Fs from 'fs';

import * as Rx from 'rxjs';
import { mergeMap, map, catchError, ignoreElements, takeWhile } from 'rxjs';
import { Lifecycle } from '@kbn/test';
import { ToolingLog } from '@kbn/tooling-log';
import chromeDriver from 'chromedriver';
import { Builder, logging, WebDriver } from 'selenium-webdriver';
import chrome from 'selenium-webdriver/chrome';
import firefox from 'selenium-webdriver/firefox';
import edge from 'selenium-webdriver/edge';
// @ts-ignore internal modules are not typed
import { Executor } from 'selenium-webdriver/lib/http';
// @ts-ignore internal modules are not typed
import { getLogger } from 'selenium-webdriver/lib/logging';
import { installDriver } from 'ms-chromium-edge-driver';

import { REPO_ROOT } from '@kbn/repo-info';
import { FINAL_LOG_ENTRY_PREFIX, pollForLogEntry$ } from './poll_for_log_entry';
import { createStdoutSocket } from './create_stdout_stream';
import { preventParallelCalls } from './prevent_parallel_calls';

import { Browsers } from './browsers';
import { NetworkProfile, NETWORK_PROFILES } from './network_profiles';

interface Configuration {
  throttleOption: string;
  headlessBrowser: string;
  browserBinaryPath: string;
  remoteDebug: string;
  certValidation: string;
  noCache: string;
  chromiumUserPrefs: Record<string, any>;
}

const now = Date.now();
const SECOND = 1000;
const MINUTE = 60 * SECOND;
const NO_QUEUE_COMMANDS = ['getLog', 'getStatus', 'newSession', 'quit'];
const downloadDir = resolve(REPO_ROOT, 'target/functional-tests/downloads');
let runtimeEnvVariables: Configuration | undefined;

// ENV variables may be injected dynamically by the test runner CLI script
// so do not read on module load, rather read on demand.
function getConfiguration(): Configuration {
  if (!runtimeEnvVariables) {
    runtimeEnvVariables = {
      throttleOption: process.env.TEST_THROTTLE_NETWORK as string,
      headlessBrowser: process.env.TEST_BROWSER_HEADLESS as string,
      browserBinaryPath: process.env.TEST_BROWSER_BINARY_PATH as string,
      remoteDebug: process.env.TEST_REMOTE_DEBUG as string,
      certValidation: process.env.NODE_TLS_REJECT_UNAUTHORIZED as string,
      noCache: process.env.TEST_DISABLE_CACHE as string,
      chromiumUserPrefs: {
        'download.default_directory': downloadDir,
        'download.prompt_for_download': false,
        'profile.password_manager_leak_detection': false,
        'profile.content_settings.exceptions.clipboard': {
          '[*.],*': {
            last_modified: now,
            setting: 1,
          },
        },
      },
    };
  }
  return runtimeEnvVariables;
}

const sleep$ = (ms: number) => Rx.timer(ms).pipe(ignoreElements());

/**
 * Best we can tell WebDriver locks up sometimes when we send too many
 * commands at once, sometimes... It causes random lockups where we never
 * receive another response from WedDriver and we don't want to live with
 * that risk, so for now I've shimmed the Executor class in WebDiver to
 * queue all calls to Executor#send() if there is already a call in
 * progress.
 */
Executor.prototype.execute = preventParallelCalls(
  Executor.prototype.execute,
  (command: { getName: () => string }) => NO_QUEUE_COMMANDS.includes(command.getName())
);

export interface BrowserConfig {
  logPollingMs: number;
  acceptInsecureCerts: boolean;
}

function initChromiumOptions(browserType: Browsers, acceptInsecureCerts: boolean) {
  const options = browserType === Browsers.Chrome ? new chrome.Options() : new edge.Options();
  const {
    headlessBrowser,
    certValidation,
    remoteDebug,
    browserBinaryPath,
    noCache,
    chromiumUserPrefs,
  } = getConfiguration();

  options.addArguments(
    // Disables the sandbox for all process types that are normally sandboxed.
    'no-sandbox',
    // Launches URL in new browser window.
    'new-window',
    // By default, file:// URIs cannot read other file:// URIs. This is an override for developers who need the old behavior for testing.
    'allow-file-access-from-files',
    // Use fake device for Media Stream to replace actual camera and microphone.
    'use-fake-device-for-media-stream',
    // Bypass the media stream infobar by selecting the default device for media streams (e.g. WebRTC). Works with --use-fake-device-for-media-stream.
    'use-fake-ui-for-media-stream',
    // Do not show "Choose your search engine" dialog (> Chrome v127)
    'disable-search-engine-choice-screen',
    // Disable component updater used for Chrome Certificate Verifier
    'disable-component-update'
  );

  if (process.platform === 'linux') {
    // The /dev/shm partition is too small in certain VM environments, causing
    // Chrome to fail or crash. Use this flag to work-around this issue
    // (a temporary directory will always be used to create anonymous shared memory files).
    options.addArguments('disable-dev-shm-usage');
  }

  if (headlessBrowser === '1') {
    // Using the new headless mode (instead of `options.headless()`)
    // See: https://www.selenium.dev/blog/2023/headless-is-going-away/
    options.addArguments('headless=new');

    // Use --disable-gpu to avoid an error from a missing Mesa library, as per
    // See: https://chromium.googlesource.com/chromium/src/+/lkgr/headless/README.md
    options.addArguments('disable-gpu');
  }

  if (certValidation === '0') {
    options.addArguments('ignore-certificate-errors');
  }

  if (remoteDebug === '1') {
    // Visit chrome://inspect in chrome to remotely view/debug

    // Using the new headless mode (instead of `options.headless()`)
    // See: https://www.selenium.dev/blog/2023/headless-is-going-away/
    options.addArguments('headless=new');

    options.addArguments('disable-gpu', 'remote-debugging-port=9222');
  }

  if (browserBinaryPath) {
    options.setBinaryPath(browserBinaryPath);
  }

  if (noCache === '1') {
    options.addArguments('disk-cache-size', '0');
    options.addArguments('disk-cache-dir', '/dev/null');
  }

  const prefs = new logging.Preferences();
  prefs.setLevel(logging.Type.BROWSER, logging.Level.ALL);
  options.setUserPreferences(chromiumUserPrefs);
  options.setLoggingPrefs(prefs);
  options.set('unexpectedAlertBehaviour', 'accept');
  options.setAcceptInsecureCerts(acceptInsecureCerts);

  return options;
}

function pollForChromiumLogs$(session: WebDriver, logPollingMs: number) {
  return pollForLogEntry$(session, logging.Type.BROWSER, logPollingMs).pipe(
    takeWhile(
      (loggingEntry: logging.Entry) => !loggingEntry.message.startsWith(FINAL_LOG_ENTRY_PREFIX)
    ),
    map(({ message, level: { name: level } }) => ({
      message: message.replace(/\\n/g, '\n'),
      level,
    }))
  );
}

let attemptCounter = 0;
let edgePaths: { driverPath: string | undefined; browserPath: string | undefined };
async function attemptToCreateCommand(
  log: ToolingLog,
  browserType: Browsers,
  lifecycle: Lifecycle,
  config: BrowserConfig
) {
  const attemptId = ++attemptCounter;
  log.debug('[webdriver] Creating session');
  const remoteSessionUrl = process.env.REMOTE_SESSION_URL;
  const { headlessBrowser, throttleOption, noCache } = getConfiguration();

  const buildDriverInstance = async () => {
    switch (browserType) {
      case 'chrome': {
        const chromeOptions = initChromiumOptions(
          browserType,
          config.acceptInsecureCerts
        ) as chrome.Options;
        let session;
        if (remoteSessionUrl) {
          session = await new Builder()
            .forBrowser(browserType)
            .setChromeOptions(chromeOptions)
            .usingServer(remoteSessionUrl)
            .build();
        } else {
          session = await new Builder()
            .forBrowser(browserType)
            .setChromeOptions(chromeOptions)
            .setChromeService(new chrome.ServiceBuilder(chromeDriver.path).enableVerboseLogging())
            .build();
        }

        return {
          session,
          consoleLog$: pollForChromiumLogs$(session, config.logPollingMs),
        };
      }

      case 'msedge': {
        if (edgePaths && edgePaths.browserPath && edgePaths.driverPath) {
          const edgeOptions = initChromiumOptions(
            browserType,
            config.acceptInsecureCerts
          ) as edge.Options;
          const session = await new Builder()
            .forBrowser('MicrosoftEdge')
            .setEdgeOptions(edgeOptions)
            .setEdgeService(new edge.ServiceBuilder(edgePaths.driverPath))
            .build();
          return {
            session,
            consoleLog$: pollForChromiumLogs$(session, config.logPollingMs),
          };
        } else {
          throw new Error(
            `Chromium Edge session requires browser or driver path to be defined: ${JSON.stringify(
              edgePaths
            )}`
          );
        }
      }

      case 'firefox': {
        const firefoxOptions = new firefox.Options();
        // Firefox 65+ supports logging console output to stdout
        firefoxOptions.set('moz:firefoxOptions', {
          prefs: { 'devtools.console.stdout.content': true },
        });
        firefoxOptions.setPreference('browser.download.folderList', 2);
        firefoxOptions.setPreference('browser.download.manager.showWhenStarting', false);
        firefoxOptions.setPreference('browser.download.dir', downloadDir);
        firefoxOptions.setPreference(
          'browser.helperApps.neverAsk.saveToDisk',
          'application/comma-separated-values, text/csv, text/plain'
        );
        firefoxOptions.setAcceptInsecureCerts(config.acceptInsecureCerts);

        if (headlessBrowser === '1') {
          // See: https://developer.mozilla.org/en-US/docs/Web/WebDriver/Capabilities/firefoxOptions
          firefoxOptions.addArguments('-headless');
        }

        // Windows issue with stout socket https://github.com/elastic/kibana/issues/52053
        if (process.platform === 'win32') {
          const session = await new Builder()
            .forBrowser(browserType)
            .setFirefoxOptions(firefoxOptions)
            .setFirefoxService(new firefox.ServiceBuilder())
            .build();
          return {
            session,
            consoleLog$: Rx.EMPTY,
          };
        }

        const { input, chunk$, cleanup } = await createStdoutSocket();
        lifecycle.cleanup.add(cleanup);

        const session = await new Builder()
          .forBrowser(browserType)
          .setFirefoxOptions(firefoxOptions)
          .setFirefoxService(new firefox.ServiceBuilder().setStdio(['ignore', input, 'ignore']))
          .build();

        const CONSOLE_LINE_RE = /^console\.([a-z]+): ([\s\S]+)/;

        return {
          session,
          consoleLog$: chunk$.pipe(
            map((chunk) => chunk.toString('utf8')),
            mergeMap((msg) => {
              const match = msg.match(CONSOLE_LINE_RE);
              if (!match) {
                log.debug('Firefox stdout: ' + msg);
                return [];
              }

              const [, level, message] = match;
              return [
                {
                  level,
                  message: message.trim(),
                },
              ];
            })
          ),
        };
      }

      default:
        throw new Error(`${browserType} is not supported yet`);
    }
  };

  const { session, consoleLog$ } = await buildDriverInstance();

  if (throttleOption === '1' && browserType === 'chrome') {
    const KBN_NETWORK_TEST_PROFILE = (process.env.KBN_NETWORK_TEST_PROFILE ??
      'CLOUD_USER') as NetworkProfile;

    const profile =
      KBN_NETWORK_TEST_PROFILE in NETWORK_PROFILES ? KBN_NETWORK_TEST_PROFILE : 'CLOUD_USER';

    const networkProfileOptions = NETWORK_PROFILES[profile];

    // Only chrome supports this option.
    log.debug(
      `NETWORK THROTTLED with profile ${profile}: ${networkProfileOptions.download_throughput} B/s down, ${networkProfileOptions.upload_throughput} B/s up, ${networkProfileOptions.latency} ms latency.`
    );

    if (noCache) {
      // @ts-expect-error
      await session.sendDevToolsCommand('Network.setCacheDisabled', {
        cacheDisabled: true,
      });
    }

    // @ts-expect-error
    session.setNetworkConditions(networkProfileOptions);
  }

  if (attemptId !== attemptCounter) {
    return;
  } // abort

  return { driver: session, consoleLog$ };
}

export async function initWebDriver(
  log: ToolingLog,
  browserType: Browsers,
  lifecycle: Lifecycle,
  config: BrowserConfig
) {
  const logger = getLogger('webdriver.http.Executor');
  logger.setLevel(logging.Level.FINEST);
  logger.addHandler((entry: { message: string }) => {
    if (entry.message.match(/\/session\/\w+\/log\b/)) {
      // ignore polling requests for logs
      return;
    }

    log.verbose(entry.message);
  });

  // create browser download folder
  Fs.mkdirSync(downloadDir, { recursive: true });

  // download Edge driver only in case of usage
  if (browserType === Browsers.ChromiumEdge) {
    edgePaths = await installDriver();
  }

  let attempt = 1;
  return await Rx.firstValueFrom(
    Rx.race(
      Rx.timer(2 * MINUTE).pipe(
        map(() => {
          throw new Error('remote failed to start within 2 minutes');
        })
      ),

      Rx.race(
        Rx.defer(async () => {
          const command = await attemptToCreateCommand(log, browserType, lifecycle, config);
          if (!command) {
            throw new Error('remote creation aborted');
          }
          return command;
        }),
        Rx.timer(30 * SECOND).pipe(
          map(() => {
            throw new Error('remote failed to start within 30 seconds');
          })
        )
      ).pipe(
        catchError((error, resubscribe) => {
          log.warning('Failure while creating webdriver instance');
          log.warning(error);

          if (attempt > 5) {
            throw new Error('out of retry attempts');
          }

          attempt += 1;
          log.warning('...retrying in 15 seconds...');
          return Rx.concat(sleep$(15000), resubscribe);
        })
      )
    )
  );
}

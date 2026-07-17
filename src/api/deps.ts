import type { FetchFollowOptions } from '../portal/http.js';
import type { SessionStore } from '../portal/session.js';
import type { ApiConfig } from './config.js';
import type { LogSink } from './logging.js';

export interface ApiDeps {
	config: ApiConfig;
	fetchOptions: FetchFollowOptions;
	log: LogSink;
	sessions: SessionStore;
}

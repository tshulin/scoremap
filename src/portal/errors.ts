export class PortalError extends Error {
	constructor(message: string, options?: ErrorOptions) {
		super(message, options);
		this.name = new.target.name;
	}
}

export class InvalidDomainError extends PortalError {}

export class AuthError extends PortalError {}

export class PortalShapeError extends PortalError {}

export class SessionExpiredError extends PortalError {}

export class ModuleUnavailableError extends PortalError {}

export class ParseError extends PortalError {}

export class PortalHttpError extends PortalError {
	readonly url: string;
	readonly status: number | undefined;

	constructor(message: string, details: { url: string; status?: number; cause?: unknown }) {
		super(message, details.cause === undefined ? undefined : { cause: details.cause });
		this.url = details.url;
		this.status = details.status;
	}
}

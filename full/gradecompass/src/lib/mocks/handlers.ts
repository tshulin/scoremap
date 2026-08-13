import { Operation, wrapEnvelope } from '$lib/synergy';
import { http, HttpResponse } from 'msw';

let attachment: string;
let attendance: string;
let document: string;
let documents: string;
let gradebook: string;
let mail: string;
let studentInfo: string;

if (import.meta.env.DEV) {
	const [
		AttachmentXML,
		Attendance,
		DocumentData,
		Gradebook,
		StudentDocuments,
		StudentInfo,
		SynergyMailDataXML
	] = (
		await Promise.all([
			import('./data/AttachmentXML.xml?raw'),
			import('./data/Attendance.xml?raw'),
			import('./data/DocumentData.xml?raw'),
			import('./data/Gradebook.xml?raw'),
			import('./data/StudentDocuments.xml?raw'),
			import('./data/StudentInfo.xml?raw'),
			import('./data/SynergyMailDataXML.xml?raw')
		])
	).map((module) => wrapEnvelope(module.default, Operation.Request));

	attachment = AttachmentXML!;
	attendance = Attendance!;
	document = DocumentData!;
	documents = StudentDocuments!;
	gradebook = Gradebook!;
	mail = SynergyMailDataXML!;
	studentInfo = StudentInfo!;
}

const soapHeaders = new Headers({
	'Content-Type': 'application/soap+xml; charset=utf-8',
	Mocked: 'true'
});

interface ProxyRequestBody {
	methodName: string;
	params?: Record<string, unknown>;
}

// Mock the server-side proxy (see src/routes/api/synergy/+server.ts). The proxy
// returns data in the legacy SOAP-enveloped shape, so the existing XML fixtures
// are reused unchanged.
export const handlers = [
	http.post('/api/synergy', async ({ request }) => {
		const { methodName } = (await request.json()) as ProxyRequestBody;

		switch (methodName) {
			case 'Gradebook':
				return HttpResponse.xml(gradebook, { headers: soapHeaders });
			case 'Attendance':
				return HttpResponse.xml(attendance, { headers: soapHeaders });
			case 'GetStudentDocumentInitialData':
				return HttpResponse.xml(documents, { headers: soapHeaders });
			case 'GetReportCardDocumentData':
				return HttpResponse.xml(document, { headers: soapHeaders });
			case 'SynergyMailGetData':
				return HttpResponse.xml(mail, { headers: soapHeaders });
			case 'SynergyMailGetAttachment':
				return HttpResponse.xml(attachment, { headers: soapHeaders });
			case 'StudentInfo':
				return HttpResponse.xml(studentInfo, { headers: soapHeaders });
			default:
				return HttpResponse.text(`${methodName} methodName not yet mocked`, { status: 500 });
		}
	})
];

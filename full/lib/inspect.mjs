// DevExpress embeds grid rows in dataSource arrays.

export function countDataSourceArrays(html) {
	return (html.match(/"dataSource":/g) ?? []).length;
}

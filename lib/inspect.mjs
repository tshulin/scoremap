// DevExpress puts each grid's rows in an embedded dataSource array.
//

export function countDataSourceArrays(html) {
	return (html.match(/"dataSource":/g) ?? []).length;
}

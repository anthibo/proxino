export function DslHelp() {
  return (
    <div className="dsl-help">
      <div className="dsl-row"><b>Fields</b> method status host path type size dur client</div>
      <div className="dsl-row"><b>Operators</b> : contains · &gt;= &lt;= compare · * wildcard</div>
      <div className="dsl-row"><b>Examples</b> <code>status:&gt;=400</code> <code>host:*.soum.sa</code> <code>client:192.168.1.23</code> <code>type:ws</code></div>
    </div>
  );
}

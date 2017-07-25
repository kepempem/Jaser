import json
import types
old_print = print


def parse_val(v):
  if v == None:
    return {'type':"none",'content':"None"}
  t = type(v).__name__
  if t == "builtin_function_or_method" or (hasattr(v,"__name__") and v.__name__ == "print"):
    return {'type':"function",'content':"&lt;built-in function "+v.__name__+"&gt;"}
  elif t == "function":
    return {'type':"function",'content':"&lt;function "+v.__name__+"&gt;"}
  elif t == "type":
    return {'type':"class",'content':"&lt;class '"+v.__name__+"'&gt;"}
  elif t == "list":
    fa = []
    for item in v:
      fa.append(parse_val(item))
    return {'type':"list",'content':fa}
  elif t == "dict":
    fo = {}
    for key,val in v.items():
      fo[key] = parse_val(val)
    return {'type':"dict",'content':fo}
  else:
    return {'type':"auto",'content':v}
def print(*args):
  if len(args) == 0:
    return None
  elif len(args) == 1:
    arg_type = type(args[0]).__name__
    old_print(json.dumps(parse_val(args[0])))
    return None
  toJoin = True
  for arg in args:
    if type(arg) is not str:
      toJoin = False
      break
  if toJoin:
    old_print(json.dumps(parse_val(" ".join(args))))
  else:
    for arg in args:
      print(arg)

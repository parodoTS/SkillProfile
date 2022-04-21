# SkillProfile


SkillProfile+GraphQL(Appsync+Dynamo)

![SkillProfile drawio](https://user-images.githubusercontent.com/100789868/164406013-a1cbf3a1-95ae-4d21-88a7-65a1ac9f671d.png)
# SkillProfile+GraphQL(Appsync+Dynamo)
### DynamoDB:
Amazon DynamoDB is a fully managed, serverless, key-value NoSQL database designed to run high-performance applications at any scale. **DynamoDB offers built-in security, continuous backups, automated multi-Region replication, in-memory caching, and data export tools.**


# Design DynamoDB table:

 DynamoDB is a schema-less database that only requires a table name and primary key when creating the table.


## Configure that it has auto scalling. To improve reading and writing.


The **read/write** capacity mode controls how you are charged for read and write performance and how you manage capacity.
### READ
**Read Capacity Auto Scaling**
Activated
**Provisioned Read Capacity Units**
1
**Provisioned interval for reads**
1 - 20
**Reading Capacity Utilization Target**
70%
### WRITE
**Write Capacity Auto Scaling**
Activated
**Provisioned Write Capacity Units**
1
**Provisioned interval for writes**
1 - 20
**Write Capacity Utilization Target**
70%

References: https://aws.amazon.com/dynamodb/getting-started/
## Lambda Function:

 Lambda is a compute service that lets you run code without provisioning or managing servers. Lambda runs your code on a high-availability compute infrastructure and performs all of the administration of the compute resources, including server and operating system maintenance, capacity provisioning and automatic scaling, code monitoring and logging. With Lambda, you can run code for virtually any type of application or backend service.

Reference: https://docs.aws.amazon.com/lambda/latest/dg/lambda-python.html

## Creation Lambda Function.

Now we create the lambda function to treat the Xlsm file to Json. Once the operation is done we have to select which columns of data we need to import them correctly in our table in DynamoDB.

From this link we can access the repository with the code: https://github.com/parodoTS/SkillProfile/blob/main/Lambda/XLSM2JSON.py

Now let´s reviews the code of the lambda functions

>import boto3
import json
import urllib.parse
from collections import OrderedDict
from itertools import islice
from openpyxl import load_workbook**


>def lambda_handler(event, context):


### Part 1:

  Connect to S3 and download the EXCEL file (to /tmp/ in Lambda)
           
           s3_client = boto3.client("s3")
	 S3_BUCKET_NAME = 'skillprofilebucket'
    object_key = urllib.parse.unquote_plus(event['Records'][0]['s3']['object']['key'], encoding='utf-8') 
	   file_content = s3_client.download_file(S3_BUCKET_NAME, object_key,'/tmp/data.xlsm')

### Part 2:
 Parse data from EXCEL file to Python list using openpyxl

    wb = load_workbook('/tmp/data.xlsm')
    
    sheet1 = wb['Mapping SSP']  #Sheet with Profiles' info
    
    profile_list = []
    diccionario = {}
    
    for row in islice(sheet1.values, 3, (sheet1.max_row)-1):
        profile = OrderedDict()
        profile['ProfileID'] = row[1]
        profile['ID'] = row[1]
        profile['Name'] = row[2]
        profile['Family'] = row[16]
        profile['Cluster'] = row[17]
        profile['Description'] = row[4]
        profile_list.append(profile)
        diccionario[row[2].upper()]=row[1]
    
    
    sheet2 = wb['Skill Profiles']   #Sheet with Skills' info
    
    skill_list = []
    
    for row in islice(sheet2.values, 11, (sheet2.max_row)-1):
        skill = OrderedDict()
        skill['ProfileID'] = diccionario[row[4].upper()]
        skill['ID'] = row[5]
        skill['Category'] = row[6]
        skill['SkillName'] = row[9]
        skill['Description'] = row[10]
        Levels = OrderedDict()
        Levels['Junior'] = row[11]
        Levels['Specialist'] = row[12]
        Levels['Expert'] = row[13]
        Levels['Senior'] = row[14]
        Levels['Principal'] = row[15]
        skill['Levels']=Levels
        skill_list.append(skill)

### Part 3:
Connect to DynamoDB and upload the data to the table
 
    dynamodb = boto3.resource('dynamodb', region_name='eu-west-1')
    table = dynamodb.Table('SkillProfile')
    
    for profile in profile_list:
        table.put_item(Item=profile)
    for skill in skill_list:
        table.put_item(Item=skill)


# Appsync
Appsync is the AWS service that allows to develop GraphQL APIs (link to graphql explanation) and host them in a serverless way.
The first step once we know the queries we want to implement is to define a schema that will contains the data definition an also the operations (queries and mutations) that will be applied to them.
Connection to DynamoDB as datasource using DynamoDB resolvers written in VTL.
AppKey + cache
## Schema
In this schema we have defined three basic data types that represent the entitties in our application.

 -  **Profile:**
~~~
type Profile {
	ProfileID: String!
	Name: String!
	Description: String
	Cluster: String
	Family: String
	skills: [Skill]
}
~~~
Even our DynamoDB stores ID for each Profile (as the Sort Key), we only use ProfileID because for every profile both ProfileID will be the same. We can also see how we have defined "skills" as a field inside data type Profile wich it is an array of data type Skill (because every profile has got inside many skills).
 -  **Skill:**
~~~
type Skill {
	ID: ID!
	ProfileID: String!
	SkillName: String!
	Description: String
	Category: String
	Levels: Level
}
~~~
In this case, Skill has got both ID and ProfileID ans also a field "Levels" containing the five different categories defined in our data.
 -  **Level:**
~~~
type Level {
	Junior: Int
	Senior: Int
	Expert: Int
	Specialist: Int
	Principal: Int
}
~~~
Level contains five fields, each one for each category; defined as Int.

In the schema we also define the queries that will be allowed:
~~~
type Query {
	getProfile(ProfileID: String!): Profile
	listProfiles(filter: TableProfileFilterInput, limit: Int, nextToken: String): ProfileConnection
	ProfileConnection
	getSkill(ID: String!, nextToken: String): SkillProfile
}
~~~
Three queries are allowed:

 1. getProfile in which we ask a ProfileID and we get a Profile
 2. listProfiles to get all profiles that match a specific filter that we pass to the query (defined in the TableProfileFilterInput)
 3. getSkill in which we can ask a skill ID and it returns a skill and all profiles that have these skill with the levels asociated (we use another data type called SkillProfile which copy skill's field and add a field to include profiles, as the return type)

## Resolvers
As we have said, we are using a single table DynamoDB as datasource, and the connection to it is implemented using resolvers written in VTL.

 **1. getProfile:**
This query has been implemented using DynamoDB Query method. Taking advantage of the single table design we can run this query using only one operation to the database. To return one profile and the skills asociated to it, we simply query using the ProfileID (PK, because we have stored our skills with this field pointing their profile). In order to not overfetch the response and get the skills if the client did not ask for them; in the request template we start by checking if the skills field were requested, if not we query for just the profile (adding the ID field to the query, which must be the same as the ProfileID for the profiles).

    #if(!$ctx.info.selectionSetList.contains("skills"))
    #set($expression=$expression + " and #ID = :ID")
    $util.qr($expressionNames.put("#ID", "ID"))
    $util.qr($expressionValues.put(":ID", $util.dynamodb.toDynamoDB($context.args.ProfileID)))
    #end
In the response template we need to reorganize our response data to match the schema definition:

    #if($context.result.items.size() == 0)
      $utils.error("NotFound", "NotFound");
    #else
      #set ($profile = {})
      #foreach($item in $context.result.items)
        #if($item.ID == $item.ProfileID)
          #set ($profile = $item)
          $util.qr($profile.put("skills", []))
        #else
          #if($item.ID != $item.ProfileID)
            $util.qr($profile.skills.add($item))
        #end
      #end
    #end
    $utils.toJson($profile)
    #end
We iterate through the items in the response and if they are skills (ID different from ProfileID) we add them to the profile.

 **2. listProfiles:**
  In this query we use the Scan method of DynamoDB, which retrieves all items in the table (consumes more capacity) and allows us to filter through them; all in one sigle operation as the getProfile query.
  First, in the request template, we check if some filter were used, in that case we add to the filter the expression that allows skills to be retrieve too (OR "is a skill").

    #if($context.args.filter)
    #set($variable=$util.parseJson($util.transform.toDynamoDBFilterExpression($ctx.args.filter)))
      #set($variable.expression = $variable.expression + " or NOT contains(#ID, :ID)" )
      $util.qr($variable.expressionNames.put("#ID", "ID"))
      $util.qr($variable.expressionValues.put(":ID",{"S":"-"}))
    #end 
*In this case the "is a skill" condition have been implemented based in that all skills' ID contains an "-", this should be improved.
 
Due to the DynamoDB limitations (Scan/Query operation can only retrieve up to 1MB)  we would not be able to get all items in just one operation so we need to implement pagination in order to recall the operation from the last evaluated key. For that we use the "nextToken" param.

In the response template we reorganize the data in a similar way as in the getProfile.

 **3. getSkill** 
This query operation differs from the previous ones because it uses two call to the databases, thats why instead of using directly one resolver, we build a Pipeline resolver composed of 2 functions (each one is like a single resolver that pass the results to the next one).

The first function is **getProfilesWithSkill**, which make a first request using Query operation to retrieve all occurences of a skill. To accomplish that we set up a secondary index in DynamoDB on the field ID. 
In the response template we reorganize the data but in this case the Skill request will be the parent entity that contains some Profiles (because of that in the schema we have defined a SkillProfile type with this fields). This data is passed to the next function in the pipeline.

The second function is **getBatchProfiles**, which receives the ProfileID from all appearances of the skill requested and do a BatchGetItem (operation that allows us to retrieve more than one item in one database operation) to get all profiles.

    #set($keys=[])
    #foreach($item in $ctx.prev.result.profiles)
     #set($map = {})
        $util.qr($map.put("ProfileID", $util.dynamodb.toString($item.ProfileID)))
        $util.qr($map.put("ID", $util.dynamodb.toString($item.ProfileID)))
        $util.qr($keys.add($map))
    #end

We iterate through the previous result "$ctx.prev.result.profiles" and set the keys that will be in the query. 
The BatchGetItem operation has a limitation of 100 items returned, so we need to implement pagination too using nextToken (also we have to be carefull with this limit and manage it in the previous function getProfilesWithSkill, we have set the default limit to 100).

In the response template we reorganize the data (adding the profile info requested).

The pipeline also have an after mapping template in which we add the nextToken for pagination from the first function to the results and return them.

    ## getProfiles - after mapping
    $util.qr($ctx.result.put("nextToken", $ctx.stash.nextToken))
    $util.toJson($ctx.result)


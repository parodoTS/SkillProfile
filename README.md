#  SkillProfile (Appsync+DynamoDB)


In this project we are going to implement a GraphQL API to query data from an EXCEL file. All this backend implementation is developed and hosted using AWS services. It is made up of the following parts:

 1. We upload an EXCEL file containing all data we want to a S3 bucket.
 2. A Lambda function is triggered, it parse the data on the file and upload it to a DynamoDB database.
 3. We used AppSync to deploy the GraphQL API that will receive requests and reply to them, querying the database.
 
 The following diagram shows the implementation:

![SkillProfile drawio](https://user-images.githubusercontent.com/100789868/164406013-a1cbf3a1-95ae-4d21-88a7-65a1ac9f671d.png)

>All this implementation has been build up trying to get advantage of a serverless architecture
# Data
We will start disscussing briefly the EXCEL file containing the data. This file is a ".xlsm" extension file and it is composed of some sheets, each one with different data entities all about job profiles, the neccesary skills for each one, and the levels of kwoledge on these skills to reach a category (Junior, Senior...) on that specific profile.

It looks like:

### **Skills sheet:**
![image](https://user-images.githubusercontent.com/100789868/164491226-c3dcb5e5-3f68-47db-840b-c0e9a9a9b0c4.png)
### **Profiles sheet:**
![image](https://user-images.githubusercontent.com/100789868/164490558-b0e0c5a6-4457-43b1-a0df-24e2d406dae0.png)

We upload this EXCEL file without any modifications to a S3 bucket.

The next step we are going to describe is the set up and design of the DynamoDB database in order to store all this data.

#  DynamoDB

> Amazon DynamoDB is a fully managed, serverless, key-value NoSQL
> database designed to run high-performance applications at any scale.
> **DynamoDB offers built-in security, continuous backups, automated multi-Region replication, in-memory caching, and data export tools.**

References: https://aws.amazon.com/dynamodb/getting-started/

##  Designing DynamoDB table:

DynamoDB is a schema-less database that only requires a table name and a primary key when creating the table. As a NoSQL database, its design changes from a typical relational database where for example we can use Joins operations. In this NoSQL approach we should know first the queries that we would like to implement. In our case, we want:

 - "query per profile with all skills inside it",  
 -  "list all profiles with their skills" and  
 - "query per skill with all profiles that have that skill".
 
With all these things in mind we are going to use a **single table** design to take advantages of DynamoDB features. The main benefit of using a single table in DynamoDB is to retrieve multiple, heterogenous item types using a single request. We will use a Primary Key (ProfileID) and a Sort Key (ID).

Our "SkillProfile" table looks like:
![image](https://user-images.githubusercontent.com/100789868/164500243-ea986220-3eea-4d68-aa06-93bbf16fbb68.png)
In this picture we can see a profile and a skill in the same table. The skill got the ProfileID and the ID of the skill while the profile has got the same ProfileID and ID. Those fields that only exit in one datatype are missing for the other datatype (sparse index).

In order to accomplish the query per skill, we need to set up a global secondary index on ID.

https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/bp-general-nosql-design.html#bp-general-nosql-design-concepts

## Configuration:

We have set up the table using autoscaling to improve reading and writing operations. The **read/write** capacity mode controls how you are charged for read and write performance and how you manage capacity.

| |  Table READ  |  Table WRITE| ID-index READ | ID-index WRITE
|--|--|--|--|--|
| Auto Scaling:| Activated| Activated |Activated| Activated |
|Provisioned interval:| 1-20|1-20| 1-20|1-20|
|Capacity Utilization Target:| 70%| 70%|70%| 70%|





#  Lambda Function

> Lambda is a compute service that lets you run code without
> provisioning or managing servers. Lambda runs your code on a
> high-availability compute infrastructure and performs all of the
> administration of the compute resources, including server and
> operating system maintenance, capacity provisioning and automatic
> scaling, code monitoring and logging. With Lambda, you can run code
> for virtually any type of application or backend service.

Reference: https://docs.aws.amazon.com/lambda/latest/dg/lambda-python.html

Like we have said before, the Lambda function can be divided in three parts, first it will read the data from the file stored in S3, then parse the data inside it (to retrieve only relevant data), and finally load it into the DynamoDB.
The function is written in Python 3.8, and we have configured a S3 trigger (PUT operation in our bucket, for all files with the sufix ".xlsm"), so every time we upload a file to the bucket with the .xlsm extension the fuction will run.

We also have created a Lambda Layer to allow the fuction to use the package "Openpyxl", which have been used to parse the EXCEL.

##  Code:

[Full fuction available here](https://github.com/parodoTS/SkillProfile/blob/main/Lambda/XLSM2JSON.py)

Now let´s reviews the code of the lambda function. First of all we import the neccesary packages (boto3 is the AWS SDK for Python):

    import boto3
    import urllib.parse
    from collections import OrderedDict
    from itertools import islice
    from openpyxl import load_workbook**
  
  To be able to use "openpyxl" we have set up a Lambda Layer.

###  Part 1:

We connect to S3 and download the EXCEL file (to "/tmp/" in Lambda)

    def lambda_handler(event, context):
	    s3_client = boto3.client("s3")
	    S3_BUCKET_NAME = 'skillprofilebucket'
	    object_key = urllib.parse.unquote_plus(event['Records'][0]['s3']['object']['key'], encoding='utf-8')
    
	    file_content = s3_client.download_file(S3_BUCKET_NAME, object_key,'/tmp/data.xlsm')

Note that we are retrieving the file name ("object_key") directly from the event that have trigger the function (S3 Trigger), so we do not have to hardcode the name or worry about different names (for example differents versions).

>  We could do the same for the bucket name if we want, but due to we only have one bucket in our implementation, we have decided to pass the name directly to show the simplest way of doing it.

###  Part 2:

Once we have the file downloaded, we parse data from it to Python list using openpyxl as follows:

	    wb = load_workbook('/tmp/data.xlsm')
	    
	    sheet1 = wb['Mapping SSP'] #Sheet with Profiles' info
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
		    
	    sheet2 = wb['Skill Profiles'] #Sheet with Skills' info
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
		    
The profiles information is stored in a sheet called "Mapping SSP", while the skills information is the "Skill Profiles" sheet. The function iterates through the sheets (specifically in the cells where we know the data is; this means that if the data organization in the EXCEL file changes it would affect the implementation, WE SHOULD REWRITE THE FUCTION TO MAPP THE DATA AUTOMATYCALLY, FOR EXAMPLE READING THE COLUMNS NAME IN THE FILE), and map the data to the columns we are going to store in our database.

> In the database the skills records will have the ProfileID, while in
> the file the skill sheet contains the Profile Name instead (as you can see [here](https://user-images.githubusercontent.com/100789868/164491226-c3dcb5e5-3f68-47db-840b-c0e9a9a9b0c4.png)),
> that is why we have use "diccionario" to map this two fields and
> change their info.

###  Part 3:

Finally the fuction connects to DynamoDB and uploads the data to the table:

	    dynamodb = boto3.resource('dynamodb', region_name='eu-west-1')
	    table = dynamodb.Table('SkillProfile')
	    for profile in profile_list:
		    table.put_item(Item=profile)
	    for skill in skill_list:
		    table.put_item(Item=skill)

> Note that with this fuction we only upload, overwrite data to the database; we are not taking care of data previously stored in the database. If a new file is put to the S3 bucket, it will trigger the function and upload its data to the database. No deletions are implemented in this fuction.

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

 ### 1. getProfile:
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

**Example:**
				**Query**	            
	            
	       query MyQuery2 {  getProfile(ProfileID: "00089-00") {
    Cluster
    Family
    skills {
      Levels {
        Junior
        Principal
      }
      SkillName
      ID
      ProfileID
    }
    Name
    ProfileID  }}

**Response**

     { "data": {
    "getProfile": {
      "Cluster": "POQ",
      "Family": "CF",
      "skills": [
        {
          "Levels": {
            "Junior": 0,
            "Principal": 3
          },
          "SkillName": "English",
          "ID": "LANG_0018",
          "ProfileID": "00089-00"
        },
        {
          "Levels": {
            "Junior": 0,
            "Principal": 3
          }, ........     
          ......
          ....
          ...
          ..
          .

 ### 2. listProfiles:
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

**Example:**
**Query**

	query MyQuery2 {  listProfiles(filter: {Family: {eq: "CF"}}) {
    items {
      Family
      Name
      ProfileID
      skills {
        Category
        ID
        Levels {
          Expert
        }
      }
    } }}
**Response**


	  "data": {
    "listProfiles": {
      "items": [
        {
          "Family": "CF",
          "Name": "Process Manager",
          "ProfileID": "00089-00",
          "skills": [
            {
              "Category": "Languages",
              "ID": "LANG_0018",
              "Levels": {
                "Expert": 3
              }
            },
            {
              "Category": "Professional",
              "ID": "SKILL_00020",
              "Levels": {
                "Expert": 1
              }
            }, .........
            ..........
            ......
            ..
            .

 ### 3. getSkill
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

**Example:**
**Query**

	query MyQuery2 { getSkill(ID: "SKILL_00504") {
    Category
    Description
    SkillName
    profiles {
      Levels {
        Junior
        Principal
      }
      Name
    }}}

  **Response**

	{"data": {
    "getSkill": {
      "Category": "Professional",
      "Description": "Knowledge and skills to use the configuration techniques, tools and processes.",
      "SkillName": "Configuration management",
      "profiles": [
        {
          "Levels": {
            "Junior": 2,
            "Principal": 0
          },
          "Name": "Transition & Implementation Manager"
        },
        {
          "Levels": {
            "Junior": 0,
            "Principal": 0
          },
          "Name": "Security Operator"
        },
        {
          "Levels": {
            "Junior": 0,
            "Principal": 0
          }, .......
          .......
          .....
          ...
          ..
          .


In the AppSync we have also implemented the Mutation type with operation for create, update and delete for both profiles and skills; and also the Suscription type with operations linked to each mutations. Resolvers are set up too but they have not been weel tested (because the main purpose of the project focus just on querying data from an EXCEL file).
